import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * KPI master per division (IGDERP-266, assign/edit flow rework).
 * Source: Format_HR_ORBIT.xlsx Kpi sheet (INDEKS + AKUMULASI).
 * Division list -> assign wizard (aspects prefilled, employee inputs)
 * -> edit tabs (per karyawan / aspek) -> Approved by HR (immutable,
 * payroll reads approved NILAI). Same-division scoping via the
 * superior's own employee record; writes current-month only.
 */

// NILAI ladder from the sheet (Kpi!T formula): total skor -> pengali.
export function nilaiFromTotal(total: number): number {
  if (total <= 0.75) return 0.6;
  if (total <= 0.8) return 0.7;
  if (total <= 0.85) return 0.8;
  if (total <= 0.95) return 0.9;
  if (total <= 1) return 1.0;
  if (total <= 1.15) return 1.1;
  if (total <= 1.25) return 1.2;
  if (total <= 1.3) return 1.3;
  if (total <= 1.4) return 1.4;
  return 1.2;
}

// SKOR = (capaian / target) * weight, mirrors (Q/P)*O per aspect row.
export function aspectSkor(capaian: number, target: number, weight: number): number {
  if (target <= 0) return 0;
  return (capaian / target) * weight;
}

const EPS = 1e-9;

// Code is internal only (unique per division, ordering fallback) — the UI no
// longer asks for it, so the backend mints one from the name when absent.
function slugCode(name: string): string {
  const s = (name || '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 12);
  return s || 'ASPEK';
}

// ---- assign/edit flow ----
// Period shell lives in kpiPeriodLock: absent = Belum assign,
// 'assigned' = editable, 'approved' = immutable + payroll gate.
// Legacy 'locked' rows read as approved; legacy 'open' reads as assigned.

const APPROVED_STATUSES = ['approved', 'locked'];
const FULL_SCOPE_ROLES = ['SUPERADMIN', 'OWNER', 'CHR', 'CFO'];

function isApproved(status?: string | null): boolean {
  return !!status && APPROVED_STATUSES.includes(status);
}

function currentPeriod(): { month: number; year: number } {
  const n = new Date();
  return { month: n.getMonth() + 1, year: n.getFullYear() };
}

function assertCurrentPeriod(month: number, year: number): void {
  const c = currentPeriod();
  if (month !== c.month || year !== c.year) {
    throw new BadRequestException('KPI writes are only allowed for the current month');
  }
}

function toNum(v: unknown): number {
  if (v === null || v === undefined) return NaN;
  if (typeof v === 'number') return v;
  if (typeof (v as Decimal).toNumber === 'function') return (v as Decimal).toNumber();
  return Number(v);
}

export interface SaveGridDto {
  period_month: number;
  period_year: number;
  targets?: Array<{ aspectId: string; target: number }>;
  kolektif?: Array<{ aspectId: string; value: number }>;
  scores?: Array<{ employeeId: string; aspectId: string; value: number }>;
  notes?: Array<{ employeeId: string; notes?: string | null }>;
}

@Injectable()
export class KPIService {
  constructor(private prisma: PrismaService) {}

  // ---------- division config ----------

  async getConfig(divisionId: string) {
    const division = await (this.prisma as any).division.findUnique({ where: { id: divisionId } });
    if (!division) throw new NotFoundException('Division not found');
    const config = await (this.prisma as any).kpiDivisionConfig.findUnique({ where: { divisionId } });
    return { division, config };
  }

  async upsertConfig(divisionId: string, data: { default_amount?: number; is_active?: boolean }, scope?: { userId: string; roles?: string[] }) {
    if (scope) await this.assertDivisionScope(scope.userId, scope.roles ?? [], divisionId);
    const division = await (this.prisma as any).division.findUnique({ where: { id: divisionId } });
    if (!division) throw new NotFoundException('Division not found');
    if (data.default_amount !== undefined && data.default_amount < 0) {
      throw new BadRequestException('default_amount must be >= 0');
    }
    return (this.prisma as any).kpiDivisionConfig.upsert({
      where: { divisionId },
      create: {
        divisionId,
        defaultAmount: new Decimal(data.default_amount ?? 0),
        isActive: data.is_active ?? true,
      },
      update: {
        ...(data.default_amount !== undefined ? { defaultAmount: new Decimal(data.default_amount) } : {}),
        ...(data.is_active !== undefined ? { isActive: data.is_active } : {}),
      },
    });
  }

  // ---------- scoping: full-scope roles see all, dept heads (L1-L3) see their subtree ----------
  // Employee.departmentId anchors the head; all divisions whose department
  // sits in that subtree are in scope, plus the head's own divisionId as
  // fallback (accounts without a department keep legacy own-division scope).

  async scopeDivisionIds(userId: string, roles: string[] = []): Promise<string[] | null> {
    if (roles.some((r) => FULL_SCOPE_ROLES.includes(r))) return null;
    const emp = await (this.prisma as any).employee.findUnique({ where: { userId } });
    if (!emp) throw new ForbiddenException('No division scope for this account');
    if (emp.departmentId) {
      const depts: Array<{ id: string; parentDepartmentId: string | null }> = await (
        this.prisma as any
      ).department.findMany({ select: { id: true, parentDepartmentId: true } });
      const children = new Map<string, string[]>();
      for (const d of depts) {
        if (!d.parentDepartmentId) continue;
        const list = children.get(d.parentDepartmentId) ?? [];
        list.push(d.id);
        children.set(d.parentDepartmentId, list);
      }
      const deptIds = new Set<string>([emp.departmentId]);
      const queue = [emp.departmentId];
      while (queue.length > 0) {
        const cur = queue.pop() as string;
        for (const kid of children.get(cur) ?? []) {
          if (!deptIds.has(kid)) {
            deptIds.add(kid);
            queue.push(kid);
          }
        }
      }
      const divisions: Array<{ id: string }> = await (this.prisma as any).division.findMany({
        where: { departmentId: { in: [...deptIds] } },
        select: { id: true },
      });
      const ids = new Set<string>(divisions.map((d) => d.id));
      if (emp.divisionId) ids.add(emp.divisionId);
      if (ids.size === 0) throw new ForbiddenException('No division scope for this account');
      return [...ids];
    }
    if (!emp.divisionId) throw new ForbiddenException('No division scope for this account');
    return [emp.divisionId];
  }

  async assertDivisionScope(userId: string, roles: string[] = [], divisionId: string): Promise<void> {
    const scope = await this.scopeDivisionIds(userId, roles);
    if (scope && !scope.includes(divisionId)) {
      throw new ForbiddenException('Division is outside your scope');
    }
  }

  // Division list with current-month status (Belum assign / Assigned / Approved by HR).
  async listDivisions(userId: string, roles: string[] = []) {
    const scope = await this.scopeDivisionIds(userId, roles);
    const divisions = await (this.prisma as any).division.findMany({
      where: scope ? { id: { in: scope } } : {},
      orderBy: { name: 'asc' },
    });
    const { month, year } = currentPeriod();
    const out = [];
    for (const d of divisions) {
      const shell = await (this.prisma as any).kpiPeriodLock.findUnique({
        where: { divisionId_periodMonth_periodYear: { divisionId: d.id, periodMonth: month, periodYear: year } },
      });
      const status = !shell ? 'unassigned' : isApproved(shell.status) ? 'approved' : 'assigned';
      const employeeCount = await (this.prisma as any).employee.count({
        where: { divisionId: d.id, isActive: true },
      });
      out.push({ division: d, periodMonth: month, periodYear: year, status, employeeCount });
    }
    return out;
  }

  // Assign step 1 context: master aspects + prefill from the latest previous period.
  async getAssignContext(divisionId: string, userId: string, roles: string[] = []) {
    await this.assertDivisionScope(userId, roles, divisionId);
    const division = await (this.prisma as any).division.findUnique({ where: { id: divisionId } });
    if (!division) throw new NotFoundException('Division not found');
    const { month, year } = currentPeriod();
    const shell = await (this.prisma as any).kpiPeriodLock.findUnique({
      where: { divisionId_periodMonth_periodYear: { divisionId, periodMonth: month, periodYear: year } },
    });
    if (shell) throw new ConflictException('Period is already assigned — use Edit instead');
    const aspects = await (this.prisma as any).kpiAspect.findMany({
      where: { divisionId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    const aspectIds = aspects.map((a: any) => a.id);
    let prefill: { month: number; year: number; targets: Record<string, number>; kolektif: Record<string, number> } | null = null;
    if (aspectIds.length > 0) {
      const latest = await (this.prisma as any).kpiPeriodTarget.findFirst({
        where: {
          aspectId: { in: aspectIds },
          OR: [{ periodYear: { lt: year } }, { periodYear: year, periodMonth: { lt: month } }],
        },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      });
      if (latest) {
        const [t, k] = await Promise.all([
          (this.prisma as any).kpiPeriodTarget.findMany({
            where: { aspectId: { in: aspectIds }, periodMonth: latest.periodMonth, periodYear: latest.periodYear },
          }),
          (this.prisma as any).kpiPeriodActual.findMany({
            where: { divisionId, aspectId: { in: aspectIds }, periodMonth: latest.periodMonth, periodYear: latest.periodYear },
          }),
        ]);
        const targets: Record<string, number> = {};
        for (const r of t) targets[r.aspectId] = toNum(r.target);
        const kolektif: Record<string, number> = {};
        for (const r of k) kolektif[r.aspectId] = toNum(r.value);
        prefill = { month: latest.periodMonth, year: latest.periodYear, targets, kolektif };
      }
    }
    const config = await (this.prisma as any).kpiDivisionConfig.findUnique({ where: { divisionId } });
    const weightsSum = aspects.reduce((s: number, a: any) => s + toNum(a.weight), 0);
    return {
      division,
      periodMonth: month,
      periodYear: year,
      aspects,
      prefill,
      defaultAmount: config ? toNum((config as any).defaultAmount) : 0,
      weightsSum,
    };
  }

  // Assign step 2 Simpan: creates the period shell once, then writes the grid.
  async assignPeriod(divisionId: string, dto: SaveGridDto, userId: string, roles: string[] = []) {
    await this.assertDivisionScope(userId, roles, divisionId);
    assertCurrentPeriod(dto.period_month, dto.period_year);
    const month = dto.period_month;
    const year = dto.period_year;
    const existing = await (this.prisma as any).kpiPeriodLock.findUnique({
      where: { divisionId_periodMonth_periodYear: { divisionId, periodMonth: month, periodYear: year } },
    });
    if (existing) throw new ConflictException('Period is already assigned — use Edit instead');
    const aspects = await (this.prisma as any).kpiAspect.findMany({ where: { divisionId, isActive: true } });
    if (aspects.length === 0) throw new BadRequestException('Division has no active aspects — add aspects first');
    const weightsSum = aspects.reduce((s: number, a: any) => s + toNum(a.weight), 0);
    if (Math.abs(weightsSum - 1) > EPS) {
      throw new BadRequestException(`Total bobot harus 1,00 untuk assign (saat ini ${weightsSum.toFixed(2)})`);
    }
    await (this.prisma as any).kpiPeriodLock.create({
      data: { divisionId, periodMonth: month, periodYear: year, status: 'assigned' },
    });
    await this.writeGrid(divisionId, month, year, dto, userId, aspects);
    return this.getGrid(divisionId, month, year);
  }

  // ---------- aspects ----------

  async listAspects(divisionId: string) {
    return (this.prisma as any).kpiAspect.findMany({
      where: { divisionId },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
  }

  private assertAspectPayload(data: {
    weight?: number;
    targetType?: string;
    intervalMin?: number;
    intervalMax?: number;
  }) {
    if (data.weight !== undefined && (!(data.weight > 0) || data.weight > 1)) {
      throw new BadRequestException('weight must be > 0 and <= 1');
    }
    if (data.targetType !== undefined && !['FIXED', 'PERIOD'].includes(data.targetType)) {
      throw new BadRequestException("targetType must be 'FIXED' or 'PERIOD'");
    }
    if (data.intervalMin !== undefined && data.intervalMax !== undefined && data.intervalMin >= data.intervalMax) {
      throw new BadRequestException('intervalMin must be < intervalMax');
    }
  }

  async createAspect(
    divisionId: string,
    data: {
      code?: string;
      name: string;
      description?: string;
      interval_min?: number;
      interval_max?: number;
      weight: number;
      target_type?: string;
      fixed_target?: number | null;
      is_kolektif?: boolean;
      sort_order?: number;
    },
    scope?: { userId: string; roles?: string[] },
  ) {
    if (scope) await this.assertDivisionScope(scope.userId, scope.roles ?? [], divisionId);
    const division = await (this.prisma as any).division.findUnique({ where: { id: divisionId } });
    if (!division) throw new NotFoundException('Division not found');
    // New aspects from the trimmed UI are always per-employee with a fixed
    // target; legacy kolektif/PERIOD rows were converted to FIXED (migration
    // 20261125100000, fixed_target = 100) and keep working untouched.
    const targetType = data.target_type ?? 'FIXED';
    this.assertAspectPayload({
      weight: data.weight,
      targetType,
      intervalMin: data.interval_min,
      intervalMax: data.interval_max,
    });
    if (targetType === 'FIXED' && !(Number(data.fixed_target) > 0)) {
      throw new BadRequestException('FIXED aspects require fixed_target > 0');
    }
    // Mint a unique code when the caller omits it; an explicit code that
    // collides still 409s as before.
    let code = ((data.code ?? slugCode(data.name)) || 'ASPEK').toUpperCase();
    for (let n = 0; ; n++) {
      const attempt = n === 0 ? code : `${code}-${n}`;
      const dup = await (this.prisma as any).kpiAspect.findUnique({
        where: { divisionId_code: { divisionId, code: attempt } },
      });
      if (!dup) {
        code = attempt;
        break;
      }
      if (data.code) throw new ConflictException(`Aspect code '${data.code}' already exists in this division`);
    }
    let sortOrder = data.sort_order;
    if (sortOrder === undefined) {
      const top =
        (await (this.prisma as any).kpiAspect.findMany({
          where: { divisionId },
          select: { sortOrder: true },
          orderBy: { sortOrder: 'desc' },
          take: 1,
        })) ?? [];
      sortOrder = top.length > 0 ? toNum(top[0].sortOrder ?? 0) + 1 : 0;
    }
    return (this.prisma as any).kpiAspect.create({
      data: {
        divisionId,
        code,
        name: data.name,
        description: data.description ?? null,
        intervalMin: new Decimal(data.interval_min ?? 60),
        intervalMax: new Decimal(data.interval_max ?? 140),
        weight: new Decimal(data.weight),
        targetType,
        fixedTarget: data.fixed_target != null ? new Decimal(data.fixed_target) : null,
        isKolektif: data.is_kolektif ?? false,
        sortOrder,
      },
    });
  }

  /**
   * Drag-drop ordering: ids must be the FULL ordered aspect list of the
   * division. sortOrder is metadata, so the D6 freeze does not block it.
   */
  async reorderAspects(divisionId: string, ids: string[], scope?: { userId: string; roles?: string[] }) {
    if (scope) await this.assertDivisionScope(scope.userId, scope.roles ?? [], divisionId);
    const division = await (this.prisma as any).division.findUnique({ where: { id: divisionId } });
    if (!division) throw new NotFoundException('Division not found');
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids must be a non-empty array of aspect ids');
    }
    const rows = await (this.prisma as any).kpiAspect.findMany({
      where: { divisionId },
      select: { id: true },
    });
    const owned = new Set((rows ?? []).map((r: any) => r.id));
    for (const id of ids) {
      if (!owned.has(id)) throw new BadRequestException(`Aspect ${id} does not belong to this division`);
    }
    if (ids.length !== owned.size || new Set(ids).size !== ids.length) {
      throw new BadRequestException('ids must cover every aspect of the division exactly once');
    }
    for (let i = 0; i < ids.length; i++) {
      await (this.prisma as any).kpiAspect.update({ where: { id: ids[i] }, data: { sortOrder: i } });
    }
    return this.listAspects(divisionId);
  }

  async updateAspect(
    id: string,
    data: Partial<{
      code: string;
      name: string;
      description: string | null;
      interval_min: number;
      interval_max: number;
      weight: number;
      target_type: string;
      fixed_target: number | null;
      is_kolektif?: boolean;
      sort_order?: number;
      is_active?: boolean;
    }>,
    scope?: { userId: string; roles?: string[] },
  ) {
    const existing = await (this.prisma as any).kpiAspect.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Aspect not found');
    if (scope) await this.assertDivisionScope(scope.userId, scope.roles ?? [], existing.divisionId);
    this.assertAspectPayload({
      weight: data.weight,
      targetType: data.target_type,
      intervalMin: data.interval_min,
      intervalMax: data.interval_max,
    });
    const nextType = data.target_type ?? existing.targetType;
    const nextFixed = data.fixed_target !== undefined ? data.fixed_target : toNum(existing.fixedTarget);
    if (nextType === 'FIXED' && !(Number(nextFixed) > 0)) {
      throw new BadRequestException('FIXED aspects require fixed_target > 0');
    }
    if (data.code && data.code !== existing.code) {
      const dup = await (this.prisma as any).kpiAspect.findUnique({
        where: { divisionId_code: { divisionId: existing.divisionId, code: data.code } },
      });
      if (dup) throw new ConflictException(`Aspect code '${data.code}' already exists in this division`);
    }
    // D6 freeze (approved): structural edits are blocked once the aspect is
    // in use (scores / PERIOD targets / kolektif actuals) or the division has
    // any started period shell. Metadata (name/description/sort_order) stays
    // editable; structural changes apply to future periods via a new aspect.
    const STRUCTURAL = new Set([
      'code',
      'weight',
      'target_type',
      'fixed_target',
      'is_kolektif',
      'interval_min',
      'interval_max',
      'is_active',
    ]);
    const touchesStructural = Object.keys(data).some((k) => STRUCTURAL.has(k));
    if (touchesStructural) {
      const [score, target, actual, shell] = await Promise.all([
        (this.prisma as any).kpiScore.findFirst({ where: { aspectId: id } }),
        (this.prisma as any).kpiPeriodTarget.findFirst({ where: { aspectId: id } }),
        (this.prisma as any).kpiPeriodActual.findFirst({ where: { aspectId: id } }),
        (this.prisma as any).kpiPeriodLock.findFirst({ where: { divisionId: existing.divisionId } }),
      ]);
      if (score || target || actual || shell) {
        throw new ForbiddenException(
          'Aspect is in use — edits apply to future periods only, create a new aspect instead',
        );
      }
    }
    const patch: any = {};
    if (data.code !== undefined) patch.code = data.code;
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.interval_min !== undefined) patch.intervalMin = new Decimal(data.interval_min);
    if (data.interval_max !== undefined) patch.intervalMax = new Decimal(data.interval_max);
    if (data.weight !== undefined) patch.weight = new Decimal(data.weight);
    if (data.target_type !== undefined) patch.targetType = data.target_type;
    if (data.fixed_target !== undefined) {
      patch.fixedTarget = data.fixed_target != null ? new Decimal(data.fixed_target) : null;
    }
    if (data.is_kolektif !== undefined) patch.isKolektif = data.is_kolektif;
    if (data.sort_order !== undefined) patch.sortOrder = data.sort_order;
    if (data.is_active !== undefined) patch.isActive = data.is_active;
    return (this.prisma as any).kpiAspect.update({ where: { id }, data: patch });
  }

  // ---------- grid ----------

  private async rosterOf(divisionId: string) {
    return (this.prisma as any).employee.findMany({
      where: { divisionId, isActive: true },
      include: { user: true },
      orderBy: { employeeCode: 'asc' },
    });
  }

  private async activeContractTypes(employeeIds: string[]): Promise<Record<string, string>> {
    if (employeeIds.length === 0) return {};
    const contracts = await (this.prisma as any).contract.findMany({
      where: { employeeId: { in: employeeIds }, status: 'active' },
      select: { employeeId: true, type: true },
    });
    const map: Record<string, string> = {};
    for (const c of contracts) map[c.employeeId] = c.type;
    return map;
  }

  async getGrid(divisionId: string, month: number, year: number) {
    const { division, config } = await this.getConfig(divisionId);
    const aspects = await (this.prisma as any).kpiAspect.findMany({
      where: { divisionId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });
    const lock =
      (await (this.prisma as any).kpiPeriodLock.findUnique({
        where: { divisionId_periodMonth_periodYear: { divisionId, periodMonth: month, periodYear: year } },
      })) ?? { status: 'unassigned' };

    const aspectIds = aspects.map((a: any) => a.id);
    const [targets, actuals, scores, notes] = await Promise.all([
      aspectIds.length
        ? (this.prisma as any).kpiPeriodTarget.findMany({
            where: { aspectId: { in: aspectIds }, periodMonth: month, periodYear: year },
          })
        : [],
      aspectIds.length
        ? (this.prisma as any).kpiPeriodActual.findMany({
            where: { divisionId, aspectId: { in: aspectIds }, periodMonth: month, periodYear: year },
          })
        : [],
      aspectIds.length
        ? (this.prisma as any).kpiScore.findMany({
            where: { aspectId: { in: aspectIds }, periodMonth: month, periodYear: year },
          })
        : [],
      (this.prisma as any).kpiEmployeeNote.findMany({
        where: { periodMonth: month, periodYear: year },
      }),
    ]);
    const targetByAspect: Record<string, number> = {};
    for (const a of aspects) {
      targetByAspect[a.id] = a.targetType === 'FIXED' ? toNum(a.fixedTarget) : NaN;
    }
    for (const t of targets) targetByAspect[t.aspectId] = toNum(t.target);
    const actualByAspect: Record<string, number> = {};
    for (const a of actuals) actualByAspect[a.aspectId] = toNum(a.value);
    const scoreByEmpAspect: Record<string, number> = {};
    for (const s of scores) scoreByEmpAspect[`${s.employeeId}|${s.aspectId}`] = toNum(s.value);
    const noteByEmp: Record<string, { notes: string | null; updatedBy: string | null }> = {};
    for (const n of notes) noteByEmp[n.employeeId] = { notes: n.notes, updatedBy: n.updatedBy ?? null };

    const roster = await this.rosterOf(divisionId);
    const contractTypes = await this.activeContractTypes(roster.map((e: any) => e.id));
    const weightsSum = aspects.reduce((s: number, a: any) => s + toNum(a.weight), 0);

    const employees = roster.map((e: any) => {
      const ctype = contractTypes[e.id];
      if (ctype === 'trial' || ctype === 'probation') {
        return {
          employee: e,
          excludedReason: `contract ${ctype} — no KPI until lulus probation`,
          incomplete: [] as string[],
          total: null as number | null,
          nilai: null as number | null,
          bonus: null as number | null,
          scores: {} as Record<string, number>,
          note: noteByEmp[e.id]?.notes ?? null,
        };
      }
      const rowScores: Record<string, number> = {};
      const incomplete: string[] = [];
      let total = 0;
      for (const a of aspects) {
        const target = targetByAspect[a.id];
        const capaian = a.isKolektif ? actualByAspect[a.id] : scoreByEmpAspect[`${e.id}|${a.id}`];
        if (!(target > 0) || capaian === undefined || Number.isNaN(capaian)) {
          incomplete.push(a.name);
          continue;
        }
        rowScores[a.id] = capaian;
        total += aspectSkor(capaian, target, toNum(a.weight));
      }
      const complete = incomplete.length === 0;
      const nilai = complete ? nilaiFromTotal(total) : null;
      const amount = config ? toNum((config as any).defaultAmount) : 0;
      return {
        employee: e,
        excludedReason: null as string | null,
        incomplete,
        total: complete ? total : null,
        nilai,
        bonus: complete && nilai !== null ? amount * nilai : null,
        scores: rowScores,
        note: noteByEmp[e.id]?.notes ?? null,
      };
    });

    return {
      division,
      config,
      aspekts: aspects,
      targets: targetByAspect,
      kolektif: actualByAspect,
      weightsSum,
      lock,
      employees,
    };
  }

  async saveGrid(divisionId: string, dto: SaveGridDto, userId: string, roles: string[] = []) {
    await this.assertDivisionScope(userId, roles, divisionId);
    assertCurrentPeriod(dto.period_month, dto.period_year);
    const month = dto.period_month;
    const year = dto.period_year;
    if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) {
      throw new BadRequestException('Invalid period');
    }
    const shell = await (this.prisma as any).kpiPeriodLock.findUnique({
      where: { divisionId_periodMonth_periodYear: { divisionId, periodMonth: month, periodYear: year } },
    });
    if (!shell) {
      throw new ConflictException('Period is not assigned yet — assign first');
    }
    if (isApproved(shell.status)) {
      throw new ForbiddenException('Approved by HR — data can no longer change');
    }
    const aspects = await (this.prisma as any).kpiAspect.findMany({ where: { divisionId, isActive: true } });
    await this.writeGrid(divisionId, month, year, dto, userId, aspects);
    return this.getGrid(divisionId, month, year);
  }

  // Shared period writer (assign + edit). Aspects are loaded by the caller.
  private async writeGrid(
    divisionId: string,
    month: number,
    year: number,
    dto: SaveGridDto,
    userId: string,
    aspects: any[],
  ) {
    const byId: Record<string, any> = {};
    for (const a of aspects) byId[a.id] = a;
    const assertOwned = (aspectId: string) => {
      const a = byId[aspectId];
      if (!a) throw new BadRequestException(`Aspect ${aspectId} does not belong to this division`);
      return a;
    };

    for (const t of dto.targets ?? []) {
      const a = assertOwned(t.aspectId);
      if (a.targetType !== 'PERIOD') throw new BadRequestException(`Aspect ${a.name} is FIXED — target is not set per period`);
      if (!(t.target > 0)) throw new BadRequestException(`Target for ${a.name} must be > 0`);
      await (this.prisma as any).kpiPeriodTarget.upsert({
        where: { aspectId_periodMonth_periodYear: { aspectId: t.aspectId, periodMonth: month, periodYear: year } },
        create: { aspectId: t.aspectId, periodMonth: month, periodYear: year, target: new Decimal(t.target) },
        update: { target: new Decimal(t.target) },
      });
    }
    for (const k of dto.kolektif ?? []) {
      const a = assertOwned(k.aspectId);
      if (!a.isKolektif) throw new BadRequestException(`Aspect ${a.name} is not kolektif — score it per employee instead`);
      if (!(k.value >= 0)) throw new BadRequestException(`Kolektif value for ${a.name} must be >= 0`);
      await (this.prisma as any).kpiPeriodActual.upsert({
        where: {
          divisionId_aspectId_periodMonth_periodYear: { divisionId, aspectId: k.aspectId, periodMonth: month, periodYear: year },
        },
        create: { divisionId, aspectId: k.aspectId, periodMonth: month, periodYear: year, value: new Decimal(k.value) },
        update: { value: new Decimal(k.value) },
      });
    }
    for (const s of dto.scores ?? []) {
      const a = assertOwned(s.aspectId);
      if (a.isKolektif) throw new BadRequestException(`Aspect ${a.name} is kolektif — set it once per division, not per employee`);
      const lo = toNum(a.intervalMin);
      const hi = toNum(a.intervalMax);
      if (!(s.value >= lo && s.value <= hi)) {
        throw new BadRequestException(`Score for ${a.name} must be within interval ${lo}-${hi}`);
      }
      const emp = await (this.prisma as any).employee.findUnique({ where: { id: s.employeeId } });
      if (!emp || emp.divisionId !== divisionId) {
        throw new BadRequestException(`Employee ${s.employeeId} is not in this division`);
      }
      await (this.prisma as any).kpiScore.upsert({
        where: {
          employeeId_aspectId_periodMonth_periodYear: {
            employeeId: s.employeeId,
            aspectId: s.aspectId,
            periodMonth: month,
            periodYear: year,
          },
        },
        create: {
          employeeId: s.employeeId,
          aspectId: s.aspectId,
          periodMonth: month,
          periodYear: year,
          value: new Decimal(s.value),
        },
        update: { value: new Decimal(s.value) },
      });
    }
    for (const n of dto.notes ?? []) {
      await (this.prisma as any).kpiEmployeeNote.upsert({
        where: {
          employeeId_periodMonth_periodYear: { employeeId: n.employeeId, periodMonth: month, periodYear: year },
        },
        create: { employeeId: n.employeeId, periodMonth: month, periodYear: year, notes: n.notes ?? null, updatedBy: userId },
        update: { notes: n.notes ?? null, updatedBy: userId },
      });
    }
  }

  async approvePeriod(divisionId: string, month: number, year: number, userId: string, roles: string[] = []) {
    await this.assertDivisionScope(userId, roles, divisionId);
    assertCurrentPeriod(month, year);
    const grid: any = await this.getGrid(divisionId, month, year);
    const gaps: string[] = [];
    const amount = grid.config ? toNum(grid.config.defaultAmount) : 0;
    if (!(amount > 0)) gaps.push('division default_amount is not set (> 0 required)');
    if (Math.abs(grid.weightsSum - 1) > EPS) gaps.push(`active weights sum to ${grid.weightsSum}, must equal 1.0`);
    for (const a of grid.aspekts) {
      const target = grid.targets[a.id];
      if (!(target > 0)) gaps.push(`target missing for ${a.name}`);
      if (a.isKolektif && grid.kolektif[a.id] === undefined) gaps.push(`kolektif value missing for ${a.name}`);
    }
    for (const row of grid.employees) {
      if (row.excludedReason) continue;
      if (row.incomplete.length > 0) {
        gaps.push(`${row.employee.employeeCode ?? row.employee.id}: missing ${row.incomplete.join(', ')}`);
      }
    }
    if (gaps.length > 0) {
      throw new BadRequestException({ message: 'Period is not complete', gaps });
    }
    return (this.prisma as any).kpiPeriodLock.upsert({
      where: { divisionId_periodMonth_periodYear: { divisionId, periodMonth: month, periodYear: year } },
      create: { divisionId, periodMonth: month, periodYear: year, status: 'approved', lockedBy: userId, lockedAt: new Date() },
      update: { status: 'approved', lockedBy: userId, lockedAt: new Date() },
    });
  }

  // ---------- staff view + payroll ----------

  async getEmployeeKpi(employeeId: string, month?: number, year?: number) {
    const employee = await (this.prisma as any).employee.findUnique({
      where: { id: employeeId },
      include: { division: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (!employee.divisionId) return { employee, periods: [] };
    // Latest approved periods first (legacy 'locked' rows read as approved); optional narrow to one period.
    const locks = await (this.prisma as any).kpiPeriodLock.findMany({
      where: {
        divisionId: employee.divisionId,
        status: { in: ['approved', 'locked'] },
        ...(month ? { periodMonth: month } : {}),
        ...(year ? { periodYear: year } : {}),
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      take: month && year ? 1 : 12,
    });
    const periods = [];
    for (const l of locks) {
      periods.push(await this.computeEmployeePeriod(employee, l.periodMonth, l.periodYear));
    }
    return { employee, periods };
  }

  async computeEmployeePeriod(employee: any, month: number, year: number) {
    const divisionId = employee.divisionId;
    const grid: any = await this.getGrid(divisionId, month, year);
    const row = grid.employees.find((r: any) => r.employee.id === employee.id);
    if (!row) return { periodMonth: month, periodYear: year, status: 'not-in-roster' as const };
    if (row.excludedReason) {
      return { periodMonth: month, periodYear: year, status: 'excluded' as const, reason: row.excludedReason };
    }
    const approved = grid.lock && isApproved(grid.lock.status);
    const assigned = grid.lock && grid.lock.status !== 'unassigned';
    return {
      periodMonth: month,
      periodYear: year,
      status: (approved ? 'approved' : assigned ? 'assigned' : 'unassigned') as 'approved' | 'assigned' | 'unassigned',
      total: row.total,
      nilai: row.nilai,
      bonus: approved ? row.bonus : null,
      incomplete: row.incomplete,
      note: row.note,
    };
  }

  // Payroll link: approved NILAI x division default_amount. Zero + reason otherwise.
  async payrollKpi(
    employeeId: string,
    month: number,
    year: number,
  ): Promise<{ bonus: Decimal; nilai: Decimal; reason: string | null }> {
    const employee = await (this.prisma as any).employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    if (!employee.divisionId) {
      return { bonus: new Decimal(0), nilai: new Decimal(0), reason: 'employee has no division' };
    }
    const computed: any = await this.computeEmployeePeriod(employee, month, year);
    if (computed.status === 'excluded') {
      return { bonus: new Decimal(0), nilai: new Decimal(0), reason: computed.reason };
    }
    if (computed.status !== 'approved' || computed.nilai === null) {
      return { bonus: new Decimal(0), nilai: new Decimal(0), reason: 'KPI period is not approved by HR yet' };
    }
    return {
      bonus: new Decimal(computed.bonus ?? 0),
      nilai: new Decimal(computed.nilai),
      reason: null,
    };
  }
}
