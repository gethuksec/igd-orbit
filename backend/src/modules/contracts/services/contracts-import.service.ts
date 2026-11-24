import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { PasswordService } from '../../../shared/services/password.service';
import {
  parseContractImportBuffer,
  excelSerialToDate,
  parseContractImportNumber,
  buildContractImportTemplate,
  normalizeEducation,
  ContractImportPrefillRow,
  RawContractImportRow,
} from '../../../shared/utils/contract-import-template';
import { ContractsService } from './contracts.service';

/**
 * Contract bulk import-as-intake (IGDERP-271 + IGDERP-298): payroll sheet
 * in, drafts out — plus new-NIP rows that run the single-intake
 * transaction (user with generated password + mustChangePassword, employee
 * with employeeCode = NIP, first contract as draft).
 *
 * Stateless two-step mirroring customers import — dry-run validates and
 * reports per row (zero writes), commit re-parses and creates rows for the
 * valid ones (caps deferred to activation). Identity is NIP =
 * employeeCode. IGDERP-299 (D1): any row touching an employee with an
 * active contract is rejected (no silent replace — the Doyo case).
 */
export interface ContractImportRowReport {
  rowNumber: number;
  nip?: string;
  name?: string;
  status: 'ok' | 'error';
  errors: string[];
  incomplete: string[];
  notes: string[];
  preview: {
    type?: string;
    startDate?: string;
    endDate?: string | null;
    positionCode?: string | null;
    gradeCode?: string | null;
    divisionCode?: string | null;
    departmentCode?: string | null;
    branchCodes?: string[];
    basicSalary?: number | null;
    /** New NIP — commit runs the intake transaction for this row. */
    isNew?: boolean;
    email?: string | null;
    phone?: string | null;
    education?: string | null;
  };
}

export interface ContractImportDryRunResult {
  total: number;
  valid: number;
  invalid: number;
  rows: ContractImportRowReport[];
  multiRowEmployees: string[];
}

export interface ContractImportCommitResult extends ContractImportDryRunResult {
  created: {
    rowNumber: number;
    contractNumber: string;
    nip: string;
    /** True when the row provisioned a new user + employee. */
    isNew?: boolean;
    /** One-time generated password — shown once to HR, never persisted. */
    tempPassword?: string;
    note?: string;
  }[];
  skipped: { rowNumber: number; nip?: string; errors: string[] }[];
}

const TYPE_MAP: Record<string, string> = {
  lifetime: 'pkwtt',
  tetap: 'pkwtt',
  pkwtt: 'pkwtt',
  annual: 'pkwt',
  tahunan: 'pkwt',
  kontrak: 'pkwt',
  pkwt: 'pkwt',
  trial: 'trial',
  percobaan: 'trial',
  'masapercobaan': 'trial',
  probation: 'probation',
};

const LEVEL_HEAD_MAP: Record<string, string> = {
  teknisi: 'TC',
  tc: 'TC',
  'adm/cs': 'CS',
  cs: 'CS',
  'spvsc': 'SPV-SC',
  'spv-sc': 'SPV-SC',
  'spvsupplychain': 'SPV-SC',
  headstore: 'HS',
  hs: 'HS',
  'headstore(hs)': 'HS',
  'assistantstore(as)': 'AS',
  'assistantstore': 'AS',
  as: 'AS',
  sodo: 'SODO',
  mp: 'MP',
  ao: 'AO',
  hr: 'HR',
  mt: 'MT',
  se: 'SE',
  cr: 'CR',
  fl: 'FL',
  sm: 'SM',
  adv: 'ADV',
  smo: 'SMO',
  crm: 'CRM',
  mo: 'MO',
  mm: 'MM',
  ms: 'MS',
  mu: 'MU',
  'spvmarketing': 'SPV-MKT',
  'spv-mkt': 'SPV-MKT',
  'spvfo': 'SPV-FO',
  'spv-fo': 'SPV-FO',
  'spvfinance&accounting': 'SPV-FO',
  'spvhrd': 'SPV-HRD',
  'spv-hrd': 'SPV-HRD',
};

const SECTOR_DIVISION_MAP: Record<string, string> = {
  service: 'DIV-OPS-SRV',
  sales: 'DIV-OPS-SE',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normKey = (v: any) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/[_\s]+/g, '');

interface MasterCache {
  employees: Map<string, { id: string }>;
  usersByEmail: Map<string, { id: string }>;
  positions: Map<string, { id: string; rank?: number | null; departmentId?: string | null; divisionId?: string | null }>;
  grades: Map<string, { id: string }>;
  divisions: Map<string, { id: string }>;
  divisionsById: Map<string, { code: string }>;
  departments: Map<string, { id: string }>;
  departmentsById: Map<string, { code: string }>;
  branchesByCode: Map<string, { id: string; code: string }>;
  branchesByName: Map<string, { id: string; code: string }>;
  /** Employee ids holding an active contract (D1 anti-replace). */
  activeEmployeeIds: Set<string>;
}

@Injectable()
export class ContractsImportService {
  constructor(
    private prisma: PrismaService,
    private contracts: ContractsService,
    private passwordService: PasswordService,
  ) {}

  /** Template payload: all current employees + reference-sheet masters. */
  async buildImportTemplate(): Promise<Buffer> {
    const employees = await this.prisma.employee.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
        position: { select: { code: true } },
        division: { select: { code: true } },
        branch: { select: { code: true } },
      },
      orderBy: { user: { fullName: 'asc' } },
    });
    const prefill: ContractImportPrefillRow[] = (employees as any[]).map((e) => {
      const posCode: string | null = e.position?.code ?? null;
      let jabatan: string | null = null;
      let grade: string | null = null;
      if (posCode) {
        const m = posCode.match(/^(.+)-([1-6])$/);
        if (m) {
          jabatan = m[1];
          grade = m[2];
        } else {
          jabatan = posCode;
        }
      }
      return {
        name: e.user?.fullName ?? e.employeeCode,
        nip: e.employeeCode,
        email: e.user?.email ?? null,
        phone: e.user?.phone ?? null,
        jabatan,
        grade,
        divisi: e.division?.code ?? null,
        startDate: e.hireDate ?? null,
        area: e.branch?.code ?? null,
        basicSalary: e.basicSalary == null ? null : Number(e.basicSalary),
        education: (e as any).education ?? null,
      };
    });
    const [branches, positions, departments, divisions] = await Promise.all([
      this.prisma.branch.findMany({ where: { isActive: true }, select: { code: true, name: true } }),
      this.prisma.position.findMany({
        where: { isActive: true },
        select: { code: true, name: true, rank: true, departmentId: true, divisionId: true },
      }),
      this.prisma.department.findMany({ where: { isActive: true }, select: { id: true, code: true } }),
      this.prisma.division.findMany({ where: { isActive: true }, select: { id: true, code: true } }),
    ]);
    const deptById = new Map((departments as any[]).map((d) => [d.id, d.code]));
    const divById = new Map((divisions as any[]).map((d) => [d.id, d.code]));
    const seen = new Set<string>();
    const titles = (positions as any[])
      .map((p) => {
        const m = String(p.code).match(/^(.+)-([1-6])$/);
        const head = m ? m[1] : String(p.code);
        return { head, row: p };
      })
      .filter((t) => {
        if (seen.has(t.head)) return false;
        seen.add(t.head);
        return true;
      })
      .map((t) => {
        const sameHead = (positions as any[]).filter((p) => {
          const m = String(p.code).match(/^(.+)-([1-6])$/);
          return (m ? m[1] : String(p.code)) === t.head;
        });
        const graded = sameHead.some((p) => (p as any).rank === 6);
        return {
          code: t.head,
          name: (t.row as any).name ?? t.head,
          departmentCode: deptById.get((t.row as any).departmentId) ?? null,
          divisionCode: divById.get((t.row as any).divisionId) ?? null,
          grades: graded ? '1-6' : '—',
        };
      });
    return buildContractImportTemplate(prefill, {
      outlets: (branches as any[]).map((b) => ({ code: b.code, name: b.name })),
      titles,
    });
  }

  private async loadMasters(): Promise<MasterCache> {
    const [employees, users, positions, grades, divisions, departments, branches, activeContracts] =
      await Promise.all([
        this.prisma.employee.findMany({ select: { id: true, employeeCode: true } }),
        this.prisma.user.findMany({ select: { id: true, email: true } }),
        this.prisma.position.findMany({
          where: { isActive: true },
          select: { id: true, code: true, rank: true, departmentId: true, divisionId: true },
        }),
        this.prisma.grade.findMany({ select: { id: true, code: true } }),
        this.prisma.division.findMany({ where: { isActive: true }, select: { id: true, code: true } }),
        this.prisma.department.findMany({ where: { isActive: true }, select: { id: true, code: true } }),
        this.prisma.branch.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true } }),
        // D1 anti-replace: employees holding an active contract right now.
        this.prisma.contract.findMany({
          where: {
            status: 'active',
            startDate: { lte: new Date() },
            OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
          },
          select: { employeeId: true },
        }),
      ]);
    const employeesMap = new Map(
      (employees as any[]).map((e) => [String(e.employeeCode).trim().toUpperCase(), { id: e.id }]),
    );
    return {
      employees: employeesMap,
      usersByEmail: new Map(
        (users as any[]).map((u) => [String(u.email).trim().toLowerCase(), { id: u.id }]),
      ),
      positions: new Map(
        (positions as any[]).map((p) => [
          String(p.code).toUpperCase(),
          { id: p.id, rank: (p as any).rank ?? null, departmentId: (p as any).departmentId ?? null, divisionId: (p as any).divisionId ?? null },
        ]),
      ),
      grades: new Map((grades as any[]).map((g) => [String(g.code).toUpperCase(), { id: g.id }])),
      divisions: new Map((divisions as any[]).map((d) => [String(d.code).toUpperCase(), { id: d.id }])),
      divisionsById: new Map((divisions as any[]).map((d) => [d.id, { code: d.code }])),
      departments: new Map((departments as any[]).map((d) => [String(d.code).toUpperCase(), { id: d.id }])),
      departmentsById: new Map((departments as any[]).map((d) => [d.id, { code: d.code }])),
      branchesByCode: new Map(
        (branches as any[]).map((b) => [String(b.code).trim().toUpperCase(), { id: b.id, code: b.code }]),
      ),
      branchesByName: new Map(
        (branches as any[]).map((b) => [String(b.name).trim().toLowerCase(), { id: b.id, code: b.code }]),
      ),
      activeEmployeeIds: new Set((activeContracts as any[]).map((c) => c.employeeId)),
    };
  }

  private resolveRow(raw: RawContractImportRow, masters: MasterCache): ContractImportRowReport {
    const errors: string[] = [];
    const incomplete: string[] = [];
    const notes: string[] = [];
    const preview: ContractImportRowReport['preview'] = {};

    // Identity: NIP = employeeCode. Unknown NIP runs the intake path (new).
    const nip = (raw.nip ?? '').trim();
    const employee = nip ? masters.employees.get(nip.toUpperCase()) : undefined;
    if (!nip) errors.push('NIP kosong');
    const isNew = !!nip && !employee;
    preview.isNew = isNew;

    // D1 anti-replace: never touch an employee holding an active contract.
    if (employee && masters.activeEmployeeIds.has(employee.id)) {
      errors.push(
        'Karyawan sudah memiliki kontrak aktif — gunakan perpanjangan/penyesuaian, bukan import baris ini',
      );
    }

    // Name: first segment wins on '/'.
    let name = (raw.name ?? '').trim();
    if (name.includes('/')) {
      const parts = name.split('/').map((p) => p.trim()).filter(Boolean);
      notes.push(`Nama "${name}" dipisah — dipakai "${parts[0]}", diabaikan: ${parts.slice(1).join(', ')}`);
      name = parts[0] ?? '';
    }
    if (!name) errors.push('NAMA kosong');

    // Email + phone: required for new NIP (intake identity), ignored for existing.
    const email = (raw.email ?? '').trim();
    const phone = (raw.phone ?? '').trim();
    if (isNew) {
      if (!email) errors.push('EMAIL wajib untuk NIP baru');
      else if (!EMAIL_RE.test(email)) errors.push(`EMAIL "${email}" tidak valid`);
      else if (masters.usersByEmail.has(email.toLowerCase())) {
        errors.push(`EMAIL "${email}" sudah terdaftar`);
      }
      preview.email = email || null;
      preview.phone = phone || null;
    } else if (email || phone) {
      notes.push('EMAIL/NO HP diabaikan untuk NIP yang sudah ada');
    }

    // Type.
    const typeNorm = normKey(raw.contractTypeRaw);
    const type = TYPE_MAP[typeNorm];
    if (!type) errors.push(`JENIS KONTRAK "${String(raw.contractTypeRaw ?? '').trim() || '(kosong)'}" tidak dikenal`);
    else preview.type = type;

    // Dates: TGL MULAI* required, TGL SELESAI required except PKWTT.
    const startDate = excelSerialToDate(raw.startDateRaw);
    if (!startDate) errors.push('TGL MULAI kosong / tidak valid');
    else preview.startDate = startDate.toISOString().slice(0, 10);
    const endDate = excelSerialToDate(raw.endDateRaw);
    preview.endDate = endDate ? endDate.toISOString().slice(0, 10) : null;
    if (type === 'pkwtt' && endDate) {
      errors.push('PKWTT permanen — TGL SELESAI harus kosong/"-"');
    }
    if (type && type !== 'pkwtt' && !endDate) {
      errors.push('TGL SELESAI wajib untuk kontrak non-PKWTT');
    }
    if (startDate && endDate && endDate <= startDate) {
      errors.push('TGL SELESAI harus setelah TGL MULAI');
    }

    // JABATAN* + GRADE*: title head + rung. Legacy combined LEVEL values
    // ("teknisi 2", "TEKNISI-2") split when no explicit grade is given.
    const jabatanRaw = (raw.jabatan ?? '').trim();
    const gradeRaw = (raw.grade ?? '').trim();
    let headRaw = jabatanRaw;
    let legacySuffix: string | null = null;
    if (!gradeRaw && jabatanRaw) {
      const m = jabatanRaw.match(/^(.+?)[\s\-–—]+([A-Za-z0-9]+)$/);
      if (m) {
        headRaw = m[1].trim();
        legacySuffix = m[2];
      }
    }
    let gradeRank: number | null = null;
    const gradeSrc = gradeRaw || legacySuffix || '';
    if (gradeSrc) {
      const gm = gradeSrc.trim().toUpperCase().match(/^G?([1-6])$/);
      if (gm) gradeRank = parseInt(gm[1], 10);
      else notes.push(`GRADE "${gradeSrc}" tidak dikenal (1-6) — grade dikosongkan`);
    }
    if (!headRaw) {
      incomplete.push('jabatan');
      incomplete.push('grade');
    } else {
      const head = LEVEL_HEAD_MAP[normKey(headRaw).replace(/[()]/g, '')] ?? LEVEL_HEAD_MAP[normKey(headRaw)];
      let titleCode: string | null = head ?? null;
      if (!titleCode) {
        // Last resort: the head itself may already be a position code.
        titleCode = headRaw.toUpperCase();
      }
      let positionId: string | null = null;
      let gradeId: string | null = null;
      let positionCode: string | null = null;
      let gradeCode: string | null = null;
      let positionRank: number | null = null;
      let positionDivisionId: string | null = null;
      let positionDepartmentId: string | null = null;
      if (gradeRank !== null) {
        gradeCode = `G${gradeRank}`;
        const g = masters.grades.get(gradeCode);
        if (g) gradeId = g.id;
        positionCode = `${titleCode}-${gradeRank}`;
        const p = masters.positions.get(positionCode);
        if (p) {
          positionId = p.id;
          positionRank = p.rank ?? null;
          positionDivisionId = p.divisionId ?? null;
          positionDepartmentId = p.departmentId ?? null;
        }
      }
      if (!positionId) {
        positionCode = titleCode;
        const p = masters.positions.get(titleCode);
        if (p) {
          positionId = p.id;
          positionRank = p.rank ?? null;
          positionDivisionId = p.divisionId ?? null;
          positionDepartmentId = p.departmentId ?? null;
        }
      }
      if (titleCode === 'AS' && positionId === null) {
        // Ambiguous assistant-store side — resolve via DIVISI when possible.
        const divisiNorm = normKey(raw.divisi);
        const sided = divisiNorm.includes('sales') ? 'AS-SE' : divisiNorm.includes('serv') ? 'AS-SRV' : null;
        if (sided) {
          const p = masters.positions.get(sided);
          if (p) {
            positionId = p.id;
            positionCode = sided;
            positionRank = p.rank ?? null;
            positionDivisionId = p.divisionId ?? null;
            positionDepartmentId = p.departmentId ?? null;
            notes.push(`ASSISTANT STORE ambigu — dipetakan ke ${sided} via DIVISI`);
          }
        }
      }
      if (!positionId) {
        incomplete.push('jabatan');
        if (gradeRank !== null && !gradeId) incomplete.push('grade');
        else if (gradeRank === null) incomplete.push('grade');
        preview.positionCode = null;
        preview.gradeCode = null;
      } else if (positionRank !== null && positionRank < 6) {
        if (gradeRank !== null) notes.push(`GRADE diabaikan untuk jabatan struktural ${positionCode}`);
        preview.positionCode = positionCode;
        preview.gradeCode = null;
      } else {
        if (gradeRank !== null && !gradeId) incomplete.push('grade');
        else if (gradeRank === null) incomplete.push('grade');
        preview.positionCode = positionId ? positionCode : null;
        preview.gradeCode = gradeId ? gradeCode : null;
      }

      // DIVISI: optional override — otherwise derived from the position.
      // Heads (MM/MO/MS/MU/HS) carry a department with no division.
      const divisiRaw = (raw.divisi ?? '').trim();
      if (divisiRaw) {
        const divNorm = normKey(divisiRaw);
        const divCode = SECTOR_DIVISION_MAP[divNorm] ?? divisiRaw.toUpperCase();
        const d = masters.divisions.get(divCode);
        if (d) {
          preview.divisionCode = divCode;
          if (positionDivisionId) {
            const posDiv = masters.divisionsById.get(positionDivisionId);
            if (posDiv && posDiv.code !== divCode) {
              notes.push(`DIVISI override dipakai (${divCode}, jabatan membawa ${posDiv.code})`);
            }
          }
        } else {
          incomplete.push('divisi');
          notes.push(`DIVISI "${divisiRaw}" tidak dipetakan — divisi dikosongkan`);
        }
      } else if (positionDivisionId) {
        preview.divisionCode = masters.divisionsById.get(positionDivisionId)?.code ?? undefined;
      }
      if (positionDepartmentId) {
        preview.departmentCode = masters.departmentsById.get(positionDepartmentId)?.code ?? undefined;
      }
    }

    // AREA → penempatan branches (comma/semicolon separated, multi).
    const areaRaw = (raw.area ?? '').trim();
    const branchIds: string[] = [];
    const branchCodes: string[] = [];
    if (!areaRaw) {
      incomplete.push('penempatan');
    } else {
      for (const part of areaRaw.split(/[;,]/).map((p) => p.trim()).filter(Boolean)) {
        const hit =
          masters.branchesByCode.get(part.toUpperCase()) ?? masters.branchesByName.get(part.toLowerCase());
        if (hit) {
          if (!branchIds.includes(hit.id)) {
            branchIds.push(hit.id);
            branchCodes.push(hit.code);
          }
        } else {
          notes.push(`AREA "${part}" tidak cocok outlet mana pun — dilewati`);
        }
      }
      if (branchIds.length === 0) incomplete.push('penempatan');
      preview.branchCodes = branchCodes;
    }

    // Salary: GAJI POKOK* required.
    const salary = parseContractImportNumber(raw.basicSalaryRaw);
    if (salary === null) errors.push('GAJI POKOK kosong / tidak valid');
    else preview.basicSalary = salary;

    // Education: PENDIDIKAN TERAKHIR* required, validated vs jenjang list.
    const eduCode = normalizeEducation(raw.education);
    if (!eduCode) {
      const shown = String(raw.education ?? '').trim() || '(kosong)';
      errors.push(`PENDIDIKAN TERAKHIR "${shown}" tidak dikenal — lihat sheet Daftar Pendidikan`);
    } else {
      preview.education = eduCode;
    }

    return {
      rowNumber: raw.rowNumber,
      nip: nip || undefined,
      name: name || undefined,
      status: errors.length > 0 ? 'error' : 'ok',
      errors,
      incomplete: [...new Set(incomplete)],
      notes,
      preview,
    };
  }

  async dryRun(buffer: Buffer): Promise<ContractImportDryRunResult> {
    const raws = await parseContractImportBuffer(buffer);
    const masters = await this.loadMasters();
    const rows = raws.map((r) => this.resolveRow(r, masters));
    // Duplicate EMAIL inside the file (new-NIP rows): all copies fail.
    const emailRows = new Map<string, number[]>();
    rows.forEach((r, i) => {
      if (r.status === 'ok' && r.preview.isNew && r.preview.email) {
        const key = r.preview.email.toLowerCase();
        emailRows.set(key, [...(emailRows.get(key) ?? []), i]);
      }
    });
    for (const [email, idxs] of emailRows) {
      if (idxs.length > 1) {
        for (const i of idxs) {
          rows[i].status = 'error';
          rows[i].errors.push(`EMAIL "${email}" duplikat di file`);
        }
      }
    }
    const byNip = new Map<string, number>();
    for (const r of rows) {
      if (r.status === 'ok' && r.nip) byNip.set(r.nip, (byNip.get(r.nip) ?? 0) + 1);
    }
    const multiRowEmployees = [...byNip.entries()].filter(([, n]) => n > 1).map(([nip]) => nip);
    return {
      total: rows.length,
      valid: rows.filter((r) => r.status === 'ok').length,
      invalid: rows.filter((r) => r.status === 'error').length,
      rows,
      multiRowEmployees,
    };
  }

  async commit(buffer: Buffer): Promise<ContractImportCommitResult> {
    const report = await this.dryRun(buffer);
    const created: ContractImportCommitResult['created'] = [];
    const skipped: ContractImportCommitResult['skipped'] = [];
    // Oldest-first per employee so the chain reads chronologically.
    const valid = report.rows
      .filter((r) => r.status === 'ok')
      .sort((a, b) => (a.preview.startDate ?? '').localeCompare(b.preview.startDate ?? ''));
    // NIPs provisioned earlier in this same run become existing rows.
    const provisioned = new Map<string, string>();
    for (const row of valid) {
      try {
        const nipUpper = row.nip!.trim().toUpperCase();
        const refs = await this.refIdsFor(row.preview);
        if (row.preview.isNew && !provisioned.has(nipUpper)) {
          const tempPassword = this.passwordService.generateStrongPassword();
          const passwordHash = await this.passwordService.hashPassword(tempPassword);
          const res = await this.contracts.intakeFromImport({
            fullName: row.name!,
            email: row.preview.email!,
            phone: row.preview.phone ?? null,
            employeeCode: row.nip!.trim(),
            education: row.preview.education ?? null,
            type: row.preview.type!,
            startDate: row.preview.startDate!,
            endDate: row.preview.endDate ?? undefined,
            positionId: refs.positionId ?? null,
            gradeId: refs.gradeId ?? null,
            divisionId: refs.divisionId ?? null,
            departmentId: refs.departmentId ?? null,
            branchIds: refs.branchIds ?? [],
            primaryBranchId: refs.primaryBranchId ?? null,
            basicSalary: row.preview.basicSalary ?? null,
            passwordHash,
          });
          provisioned.set(nipUpper, res.employeeId);
          created.push({
            rowNumber: row.rowNumber,
            contractNumber: res.contractNumber,
            nip: row.nip!,
            isNew: true,
            tempPassword,
            note: res.accessNote,
          });
        } else {
          const employeeId = provisioned.get(nipUpper) ?? (await this.employeeIdFor(row.nip!));
          const made = await this.contracts.create(
            {
              employeeId,
              type: row.preview.type!,
              startDate: row.preview.startDate!,
              endDate: row.preview.endDate ?? undefined,
              ...(row.preview.basicSalary !== undefined && row.preview.basicSalary !== null
                ? { basicSalary: row.preview.basicSalary }
                : {}),
              status: 'draft',
              changeReason: 'initial',
              ...(await this.refIdsFor(row.preview)),
            } as any,
            { deferCaps: true },
          );
          created.push({ rowNumber: row.rowNumber, contractNumber: made.contractNumber, nip: row.nip! });
        }
      } catch (e: any) {
        skipped.push({ rowNumber: row.rowNumber, nip: row.nip, errors: [e?.message ?? 'Gagal membuat kontrak'] });
      }
    }
    for (const row of report.rows.filter((r) => r.status === 'error')) {
      skipped.push({ rowNumber: row.rowNumber, nip: row.nip, errors: row.errors });
    }
    return { ...report, created, skipped };
  }

  private async employeeIdFor(nip: string): Promise<string> {
    const emp = await this.prisma.employee.findUnique({ where: { employeeCode: nip.trim() } });
    if (!emp) throw new BadRequestException(`Karyawan dengan NIP ${nip} tidak ditemukan`);
    return (emp as any).id;
  }

  private async refIdsFor(preview: ContractImportRowReport['preview']): Promise<any> {
    const out: any = {};
    if (preview.positionCode) {
      const p = await this.prisma.position.findUnique({ where: { code: preview.positionCode } });
      if (p) {
        out.positionId = (p as any).id;
        out.departmentId = (p as any).departmentId ?? out.departmentId;
        // Division comes from the DIVISI override when present.
        if (!preview.divisionCode) out.divisionId = (p as any).divisionId ?? undefined;
      }
    }
    if (preview.gradeCode) {
      const g = await this.prisma.grade.findUnique({ where: { code: preview.gradeCode } });
      if (g) out.gradeId = (g as any).id;
    }
    if (preview.divisionCode) {
      const d = await this.prisma.division.findUnique({ where: { code: preview.divisionCode } });
      if (d) out.divisionId = (d as any).id;
    }
    if (preview.departmentCode && !out.departmentId) {
      const dep = await this.prisma.department.findUnique({ where: { code: preview.departmentCode } });
      if (dep) out.departmentId = (dep as any).id;
    }
    if (preview.branchCodes && preview.branchCodes.length > 0) {
      const ids: string[] = [];
      for (const code of preview.branchCodes) {
        const b =
          (await this.prisma.branch.findUnique({ where: { code: code.toUpperCase() } }).catch(() => null)) as any;
        if (b) ids.push(b.id);
      }
      if (ids.length > 0) {
        out.branchIds = ids;
        out.primaryBranchId = ids[0];
      }
    }
    return out;
  }
}
