import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import {
  parseContractImportBuffer,
  excelSerialToDate,
  parseContractImportNumber,
  RawContractImportRow,
} from '../../../shared/utils/contract-import-template';
import { ContractsService } from './contracts.service';

/**
 * Contract bulk import (IGDERP-271): payroll sheet in, drafts out.
 *
 * Stateless two-step mirroring customers import — dry-run validates and
 * reports per row (zero writes), commit re-parses and creates draft rows
 * for the valid ones (caps deferred to activation). Identity is NIP =
 * employeeCode; unknown NIP blocks the row (import never invents users).
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
    branchCodes?: string[];
    basicSalary?: number | null;
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
  created: { rowNumber: number; contractNumber: string; nip: string }[];
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

const normKey = (v: any) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/[_\s]+/g, '');

interface MasterCache {
  employees: Map<string, { id: string }>;
  positions: Map<string, { id: string }>;
  grades: Map<string, { id: string }>;
  divisions: Map<string, { id: string }>;
  branchesByCode: Map<string, { id: string; code: string }>;
  branchesByName: Map<string, { id: string; code: string }>;
}

@Injectable()
export class ContractsImportService {
  constructor(
    private prisma: PrismaService,
    private contracts: ContractsService,
  ) {}

  private async loadMasters(): Promise<MasterCache> {
    const [employees, positions, grades, divisions, branches] = await Promise.all([
      this.prisma.employee.findMany({ select: { id: true, employeeCode: true } }),
      this.prisma.position.findMany({ where: { isActive: true }, select: { id: true, code: true } }),
      this.prisma.grade.findMany({ select: { id: true, code: true } }),
      this.prisma.division.findMany({ where: { isActive: true }, select: { id: true, code: true } }),
      this.prisma.branch.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true } }),
    ]);
    const employeesMap = new Map(
      (employees as any[]).map((e) => [String(e.employeeCode).trim().toUpperCase(), { id: e.id }]),
    );
    return {
      employees: employeesMap,
      positions: new Map((positions as any[]).map((p) => [String(p.code).toUpperCase(), { id: p.id }])),
      grades: new Map((grades as any[]).map((g) => [String(g.code).toUpperCase(), { id: g.id }])),
      divisions: new Map((divisions as any[]).map((d) => [String(d.code).toUpperCase(), { id: d.id }])),
      branchesByCode: new Map(
        (branches as any[]).map((b) => [String(b.code).trim().toUpperCase(), { id: b.id, code: b.code }]),
      ),
      branchesByName: new Map(
        (branches as any[]).map((b) => [String(b.name).trim().toLowerCase(), { id: b.id, code: b.code }]),
      ),
    };
  }

  private resolveRow(raw: RawContractImportRow, masters: MasterCache): ContractImportRowReport {
    const errors: string[] = [];
    const incomplete: string[] = [];
    const notes: string[] = [];
    const preview: ContractImportRowReport['preview'] = {};

    // Identity: NIP = employeeCode. Unknown blocks the row.
    const nip = (raw.nip ?? '').trim();
    const employee = nip ? masters.employees.get(nip.toUpperCase()) : undefined;
    if (!nip) errors.push('NIP kosong');
    else if (!employee) errors.push(`Karyawan dengan NIP ${nip} tidak ditemukan — buat via Karyawan Baru dulu`);

    // Name: first segment wins on '/'.
    let name = (raw.name ?? '').trim();
    if (name.includes('/')) {
      const parts = name.split('/').map((p) => p.trim()).filter(Boolean);
      notes.push(`Nama "${name}" dipisah — dipakai "${parts[0]}", diabaikan: ${parts.slice(1).join(', ')}`);
      name = parts[0] ?? '';
    }
    if (!name) errors.push('NAMA kosong');

    // Type.
    const typeNorm = normKey(raw.contractTypeRaw);
    const type = TYPE_MAP[typeNorm];
    if (!type) errors.push(`JENIS KONTRAK "${String(raw.contractTypeRaw ?? '').trim() || '(kosong)'}" tidak dikenal`);
    else preview.type = type;

    // Dates.
    const startDate = excelSerialToDate(raw.hireDateRaw);
    if (!startDate) errors.push('TANGGAL MASUK kosong / tidak valid');
    else preview.startDate = startDate.toISOString().slice(0, 10);
    const endDate = excelSerialToDate(raw.contractTimeRaw);
    preview.endDate = endDate ? endDate.toISOString().slice(0, 10) : null;
    if (type === 'pkwtt' && endDate) {
      errors.push('PKWTT permanen — WAKTU KONTRAK harus kosong/"-"');
    }
    if (type && type !== 'pkwtt' && !endDate) {
      incomplete.push('contract end date');
    }
    if (startDate && endDate && endDate <= startDate) {
      errors.push('WAKTU KONTRAK harus setelah TANGGAL MASUK');
    }

    // LEVEL → position + grade.
    const levelRaw = (raw.level ?? '').trim();
    if (!levelRaw) {
      incomplete.push('position');
      incomplete.push('grade');
    } else {
      const m = levelRaw.match(/^(.+?)-([A-Za-z0-9]+)$/);
      const headRaw = (m ? m[1] : levelRaw).trim();
      const suffixRaw = m ? m[2] : null;
      const head = LEVEL_HEAD_MAP[normKey(headRaw).replace(/[()]/g, '')] ?? LEVEL_HEAD_MAP[normKey(headRaw)];
      let titleCode: string | null = head ?? null;
      if (!titleCode) {
        // Last resort: the head itself may already be a position code.
        titleCode = headRaw.toUpperCase();
      }
      let gradeRank: number | null = null;
      if (suffixRaw && /^\d+$/.test(suffixRaw)) {
        gradeRank = parseInt(suffixRaw, 10);
        if (gradeRank < 1 || gradeRank > 6) gradeRank = null;
      } else if (suffixRaw) {
        notes.push(`Akhiran grade "${suffixRaw}" tidak dikenal — grade dikosongkan`);
      }
      let positionId: string | null = null;
      let gradeId: string | null = null;
      let positionCode: string | null = null;
      let gradeCode: string | null = null;
      if (gradeRank !== null) {
        gradeCode = `G${gradeRank}`;
        const g = masters.grades.get(gradeCode);
        if (g) gradeId = g.id;
        else incomplete.push('grade');
        positionCode = `${titleCode}-${gradeRank}`;
        const p = masters.positions.get(positionCode);
        if (p) positionId = p.id;
      }
      if (!positionId) {
        positionCode = titleCode;
        const p = masters.positions.get(titleCode);
        if (p) positionId = p.id;
      }
      if (titleCode === 'AS' && positionId === null) {
        // Ambiguous assistant-store side — resolve via sector when possible.
        const sectorNorm = normKey(raw.sector);
        const sided = sectorNorm.includes('sales') ? 'AS-SE' : sectorNorm.includes('serv') ? 'AS-SRV' : null;
        if (sided) {
          const p = masters.positions.get(sided);
          if (p) {
            positionId = p.id;
            positionCode = sided;
            notes.push(`ASSISTANT STORE ambigu — dipetakan ke ${sided} via SECTOR`);
          }
        }
      }
      if (!positionId) incomplete.push('position');
      if (gradeRank !== null && !gradeId) {
        if (!incomplete.includes('grade')) incomplete.push('grade');
      } else if (gradeRank === null) {
        incomplete.push('grade');
      }
      preview.positionCode = positionId ? positionCode : null;
      preview.gradeCode = gradeId ? gradeCode : null;
    }

    // SECTOR → division.
    const sectorRaw = (raw.sector ?? '').trim();
    if (!sectorRaw) {
      incomplete.push('division');
    } else {
      const sectorNorm = normKey(sectorRaw);
      const divCode = SECTOR_DIVISION_MAP[sectorNorm] ?? sectorRaw.toUpperCase();
      const d = masters.divisions.get(divCode);
      if (d) preview.divisionCode = divCode;
      else {
        incomplete.push('division');
        notes.push(`SECTOR "${sectorRaw}" tidak dipetakan — divisi dikosongkan`);
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

    // Salary.
    const salary = parseContractImportNumber(raw.basicSalaryRaw);
    if (salary === null) incomplete.push('basic salary');
    else preview.basicSalary = salary;

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
    for (const row of valid) {
      try {
        const made = await this.contracts.create(
          {
            employeeId: await this.employeeIdFor(row.nip!),
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
      if (p) out.positionId = (p as any).id;
    }
    if (preview.gradeCode) {
      const g = await this.prisma.grade.findUnique({ where: { code: preview.gradeCode } });
      if (g) out.gradeId = (g as any).id;
    }
    if (preview.divisionCode) {
      const d = await this.prisma.division.findUnique({ where: { code: preview.divisionCode } });
      if (d) out.divisionId = (d as any).id;
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
