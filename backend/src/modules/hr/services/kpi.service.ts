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
 * KPI master per division (IGDERP-266).
 * Source: Format_HR_ORBIT.xlsx Kpi sheet (INDEKS + AKUMULASI).
 * One aspect list per division; senior scores monthly grid per
 * division+period on dashboard; HR locks; payroll reads locked NILAI.
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

  async upsertConfig(divisionId: string, data: { default_amount?: number; is_active?: boolean }) {
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
      code: string;
      name: string;
      description?: string;
      interval_min?: number;
      interval_max?: number;
      weight: number;
      target_type: string;
      fixed_target?: number | null;
      is_kolektif?: boolean;
      sort_order?: number;
    },
  ) {
    const division = await (this.prisma as any).division.findUnique({ where: { id: divisionId } });
    if (!division) throw new NotFoundException('Division not found');
    this.assertAspectPayload({
      weight: data.weight,
      targetType: data.target_type,
      intervalMin: data.interval_min,
      intervalMax: data.interval_max,
    });
    if (data.target_type === 'FIXED' && !(Number(data.fixed_target) > 0)) {
      throw new BadRequestException('FIXED aspects require fixed_target > 0');
    }
    const dup = await (this.prisma as any).kpiAspect.findUnique({
      where: { divisionId_code: { divisionId, code: data.code } },
    });
    if (dup) throw new ConflictException(`Aspect code '${data.code}' already exists in this division`);
    return (this.prisma as any).kpiAspect.create({
      data: {
        divisionId,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        intervalMin: new Decimal(data.interval_min ?? 60),
        intervalMax: new Decimal(data.interval_max ?? 140),
        weight: new Decimal(data.weight),
        targetType: data.target_type,
        fixedTarget: data.fixed_target != null ? new Decimal(data.fixed_target) : null,
        isKolektif: data.is_kolektif ?? false,
        sortOrder: data.sort_order ?? 0,
      },
    });
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
      is_kolektif: boolean;
      sort_order: number;
      is_active: boolean;
    }>,
  ) {
    const existing = await (this.prisma as any).kpiAspect.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Aspect not found');
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
      })) ?? { status: 'open' };

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
          incomplete.push(a.code);
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

  async saveGrid(divisionId: string, dto: SaveGridDto, userId: string) {
    const month = dto.period_month;
    const year = dto.period_year;
    if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) {
      throw new BadRequestException('Invalid period');
    }
    const lock = await (this.prisma as any).kpiPeriodLock.findUnique({
      where: { divisionId_periodMonth_periodYear: { divisionId, periodMonth: month, periodYear: year } },
    });
    if (lock && lock.status === 'locked') {
      throw new ForbiddenException('Period is locked by HR — scores can no longer change');
    }
    const aspects = await (this.prisma as any).kpiAspect.findMany({ where: { divisionId, isActive: true } });
    const byId: Record<string, any> = {};
    for (const a of aspects) byId[a.id] = a;
    const assertOwned = (aspectId: string) => {
      const a = byId[aspectId];
      if (!a) throw new BadRequestException(`Aspect ${aspectId} does not belong to this division`);
      return a;
    };

    for (const t of dto.targets ?? []) {
      const a = assertOwned(t.aspectId);
      if (a.targetType !== 'PERIOD') throw new BadRequestException(`Aspect ${a.code} is FIXED — target is not set per period`);
      if (!(t.target > 0)) throw new BadRequestException(`Target for ${a.code} must be > 0`);
      await (this.prisma as any).kpiPeriodTarget.upsert({
        where: { aspectId_periodMonth_periodYear: { aspectId: t.aspectId, periodMonth: month, periodYear: year } },
        create: { aspectId: t.aspectId, periodMonth: month, periodYear: year, target: new Decimal(t.target) },
        update: { target: new Decimal(t.target) },
      });
    }
    for (const k of dto.kolektif ?? []) {
      const a = assertOwned(k.aspectId);
      if (!a.isKolektif) throw new BadRequestException(`Aspect ${a.code} is not kolektif — score it per employee instead`);
      if (!(k.value >= 0)) throw new BadRequestException(`Kolektif value for ${a.code} must be >= 0`);
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
      if (a.isKolektif) throw new BadRequestException(`Aspect ${a.code} is kolektif — set it once per division, not per employee`);
      const lo = toNum(a.intervalMin);
      const hi = toNum(a.intervalMax);
      if (!(s.value >= lo && s.value <= hi)) {
        throw new BadRequestException(`Score for ${a.code} must be within interval ${lo}-${hi}`);
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
    return this.getGrid(divisionId, month, year);
  }

  async lockPeriod(divisionId: string, month: number, year: number, userId: string) {
    const grid: any = await this.getGrid(divisionId, month, year);
    const gaps: string[] = [];
    const amount = grid.config ? toNum(grid.config.defaultAmount) : 0;
    if (!(amount > 0)) gaps.push('division default_amount is not set (> 0 required)');
    if (Math.abs(grid.weightsSum - 1) > EPS) gaps.push(`active weights sum to ${grid.weightsSum}, must equal 1.0`);
    for (const a of grid.aspekts) {
      const target = grid.targets[a.id];
      if (!(target > 0)) gaps.push(`target missing for ${a.code}`);
      if (a.isKolektif && grid.kolektif[a.id] === undefined) gaps.push(`kolektif value missing for ${a.code}`);
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
      create: { divisionId, periodMonth: month, periodYear: year, status: 'locked', lockedBy: userId, lockedAt: new Date() },
      update: { status: 'locked', lockedBy: userId, lockedAt: new Date() },
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
    // Latest locked periods first; optional narrow to one period.
    const locks = await (this.prisma as any).kpiPeriodLock.findMany({
      where: {
        divisionId: employee.divisionId,
        status: 'locked',
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
    const locked = grid.lock && grid.lock.status === 'locked';
    return {
      periodMonth: month,
      periodYear: year,
      status: (locked ? 'locked' : 'open') as 'locked' | 'open',
      total: row.total,
      nilai: row.nilai,
      bonus: locked ? row.bonus : null,
      incomplete: row.incomplete,
      note: row.note,
    };
  }

  // Payroll link: locked NILAI x division default_amount. Zero + reason otherwise.
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
    if (computed.status !== 'locked' || computed.nilai === null) {
      return { bonus: new Decimal(0), nilai: new Decimal(0), reason: 'KPI period is not locked yet' };
    }
    return {
      bonus: new Decimal(computed.bonus ?? 0),
      nilai: new Decimal(computed.nilai),
      reason: null,
    };
  }
}
