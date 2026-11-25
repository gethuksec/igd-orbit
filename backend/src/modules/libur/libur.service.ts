import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { ShiftsService } from '../shifts/shifts.service';
import { assertN1Approver } from '../hr/services/n1-approver';
import {
  BulkDecideLiburDto,
  CreateLiburRequestDto,
  ListLiburQuotasDto,
  ListLiburRequestsDto,
  RejectLiburRequestDto,
  UpdateEmployeeQuotaDto,
  UpdateGlobalQuotaDto,
} from './dto';

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DEFAULT_GLOBAL_QUOTA = 4;

/**
 * Libur Service — employee monthly off-day quotas + requests.
 * Quota resolution: per-employee override (khusus) wins, else global default.
 * Approve NEVER creates penalty records — it only flips status and reports overQuota.
 */
@Injectable()
export class LiburService {
  constructor(
    private prisma: PrismaService,
    private shifts: ShiftsService,
  ) {}

  /** Current month as 'YYYY-MM' (local time). */
  currentPeriod(now: Date = new Date()): string {
    const m = `${now.getMonth() + 1}`.padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  }

  /** Month after the given 'YYYY-MM'. */
  nextPeriod(period: string): string {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(y, m, 1); // month index m = next month
    const mm = `${d.getMonth() + 1}`.padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  }

  private resolvePeriod(period?: string): string {
    if (!period) return this.currentPeriod();
    if (!PERIOD_RE.test(period)) {
      throw new BadRequestException('period must be YYYY-MM');
    }
    return period;
  }

  private periodOf(date: Date): string {
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${date.getFullYear()}-${m}`;
  }

  /** Auto kind: current month => 'current', next month => 'advance', else 400. */
  resolveKind(targetPeriod: string, now: Date = new Date()): string {
    const current = this.currentPeriod(now);
    if (targetPeriod === current) return 'current';
    if (targetPeriod === this.nextPeriod(current)) return 'advance';
    throw new BadRequestException(
      `date must fall in the current (${current}) or next (${this.nextPeriod(current)}) month`,
    );
  }

  private async ensureGlobalDefault() {
    const db = this.prisma as any;
    let row = await db.liburQuotaConfig.findFirst({ where: { employeeId: null } });
    if (!row) {
      row = await db.liburQuotaConfig.create({
        data: { employeeId: null, quotaDays: DEFAULT_GLOBAL_QUOTA },
      });
    }
    return row;
  }

  private async resolveQuotaDays(employeeId: string, globalQuotaDays: number): Promise<{ quotaDays: number; quotaSource: 'global' | 'khusus' }> {
    const override = await (this.prisma as any).liburQuotaConfig.findFirst({
      where: { employeeId },
    });
    if (override) return { quotaDays: override.quotaDays, quotaSource: 'khusus' };
    return { quotaDays: globalQuotaDays, quotaSource: 'global' };
  }

  async getQuotas(query: ListLiburQuotasDto) {
    const db = this.prisma as any;
    const period = this.resolvePeriod(query.period);
    const pageNum = Number(query.page) || 1;
    const limitNum = Number(query.limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const global = await this.ensureGlobalDefault();

    const where: any = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { employeeCode: { contains: query.search, mode: 'insensitive' } },
        { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [employees, total, counts] = await Promise.all([
      db.employee.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { employeeCode: 'asc' },
        include: { user: true, liburQuotaConfig: true },
      }),
      db.employee.count({ where }),
      db.liburRequest.findMany({
        where: { targetPeriod: period, status: { in: ['approved', 'pending'] } },
        select: { employeeId: true, status: true },
      }),
    ]);

    const usedBy = new Map<string, number>();
    const pendingBy = new Map<string, number>();
    for (const r of counts) {
      if (r.status === 'approved') usedBy.set(r.employeeId, (usedBy.get(r.employeeId) ?? 0) + 1);
      else pendingBy.set(r.employeeId, (pendingBy.get(r.employeeId) ?? 0) + 1);
    }

    const data = employees.map((e: any) => {
      const override = e.liburQuotaConfig;
      const quotaDays = override ? override.quotaDays : global.quotaDays;
      const quotaSource = override ? 'khusus' : 'global';
      const used = usedBy.get(e.id) ?? 0;
      const pending = pendingBy.get(e.id) ?? 0;
      return {
        employeeId: e.id,
        employeeCode: e.employeeCode,
        fullName: e.user?.fullName ?? null,
        quotaDays,
        quotaSource,
        used,
        pending,
        remaining: quotaDays - used,
        overQuotaDays: Math.max(0, used - quotaDays),
        isOverQuota: used > quotaDays,
      };
    });

    return {
      data,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
      period,
      globalQuotaDays: global.quotaDays,
    };
  }

  async updateGlobalQuota(dto: UpdateGlobalQuotaDto, userId?: string) {
    const db = this.prisma as any;
    const existing = await db.liburQuotaConfig.findFirst({ where: { employeeId: null } });
    if (existing) {
      return db.liburQuotaConfig.update({
        where: { id: existing.id },
        data: { quotaDays: dto.quotaDays, updatedBy: userId ?? undefined },
      });
    }
    return db.liburQuotaConfig.create({
      data: { employeeId: null, quotaDays: dto.quotaDays, createdBy: userId ?? undefined },
    });
  }

  async updateEmployeeQuota(employeeId: string, dto: UpdateEmployeeQuotaDto, userId?: string) {
    const db = this.prisma as any;
    const employee = await db.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    if (dto.quotaDays === null) {
      await db.liburQuotaConfig.deleteMany({ where: { employeeId } });
      const global = await this.ensureGlobalDefault();
      return { employeeId, quotaDays: global.quotaDays, quotaSource: 'global' };
    }

    const existing = await db.liburQuotaConfig.findFirst({ where: { employeeId } });
    if (existing) {
      return db.liburQuotaConfig.update({
        where: { id: existing.id },
        data: { quotaDays: dto.quotaDays, updatedBy: userId ?? undefined },
      });
    }
    return db.liburQuotaConfig.create({
      data: { employeeId, quotaDays: dto.quotaDays, createdBy: userId ?? undefined },
    });
  }

  async listRequests(query: ListLiburRequestsDto) {
    const db = this.prisma as any;
    const pageNum = Number(query.page) || 1;
    const limitNum = Number(query.limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (query.period) {
      if (!PERIOD_RE.test(query.period)) throw new BadRequestException('period must be YYYY-MM');
      where.targetPeriod = query.period;
    }
    if (query.status) where.status = query.status;
    if (query.kind) where.kind = query.kind;
    if (query.search) {
      where.employee = {
        OR: [
          { employeeCode: { contains: query.search, mode: 'insensitive' } },
          { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      db.liburRequest.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { date: 'desc' },
        include: { employee: { include: { user: true } } },
      }),
      db.liburRequest.count({ where }),
    ]);

    return {
      data,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    };
  }

  async createRequest(dto: CreateLiburRequestDto, requestedBy: string) {
    const db = this.prisma as any;
    const employee = await db.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('date is invalid');

    const targetPeriod = this.periodOf(date);
    const kind = this.resolveKind(targetPeriod);

    // Q4 gate: window only (release = upstream roster submitted flag).
    if (employee.branchId) {
      const gate = await this.shifts.canEmployeeInput(employee.branchId, targetPeriod);
      if (!gate.open) {
        throw new ForbiddenException('Libur input is outside the roster window');
      }
    }

    const duplicate = await db.liburRequest.findFirst({
      where: {
        employeeId: dto.employeeId,
        date,
        status: { not: 'cancelled' },
      },
    });
    if (duplicate) {
      throw new ConflictException('Libur request for this employee and date already exists');
    }

    return db.liburRequest.create({
      data: {
        employeeId: dto.employeeId,
        date,
        targetPeriod,
        kind,
        status: 'pending',
        requestedBy,
      },
      include: { employee: { include: { user: true } } },
    }).then(async (created: any) => ({
      ...created,
      consecutiveWarning: await this.findConsecutiveWarning(dto.employeeId, targetPeriod, date),
    }));
  }

  // ---------- IGDERP-265 gaps: two-step approval + bulk + rules ----------

  private toISODate(d: Date | string): string {
    const day = d instanceof Date ? d : new Date(d);
    const m = `${day.getMonth() + 1}`.padStart(2, '0');
    const dd = `${day.getDate()}`.padStart(2, '0');
    return `${day.getFullYear()}-${m}-${dd}`;
  }

  /**
   * Q3 berurutan (soft): approved libur dates + roster offDates for the period
   * forming a consecutive run with `date` are reported, never blocked.
   */
  async findConsecutiveWarning(employeeId: string, targetPeriod: string, date: Date | string) {
    const db = this.prisma as any;
    const key = (d: Date | string) => new Date(d).toDateString();
    const days = new Set<string>();
    const approved =
      (await db.liburRequest?.findMany?.({
        where: { employeeId, targetPeriod, status: 'approved' },
        select: { date: true },
      })) ?? [];
    for (const r of approved as any[]) days.add(key(r.date));
    const assignments =
      (await db.shiftAssignment?.findMany?.({ where: { employeeId } })) ?? [];
    for (const a of assignments as any[]) {
      for (const off of (a.offDates ?? []) as (Date | string)[]) {
        if (this.periodOf(new Date(off)) === targetPeriod) days.add(key(off));
      }
    }
    // Roster-first: null-shift roster days count as libur in the run.
    const rosterLibur =
      (await db.shiftRosterEntry?.findMany?.({
        where: { employeeId, shiftId: null },
        select: { date: true },
      })) ?? [];
    for (const en of rosterLibur as any[]) {
      if (this.periodOf(new Date(en.date)) === targetPeriod) days.add(key(en.date));
    }
    const center = new Date(date instanceof Date ? date : new Date(date));
    if (Number.isNaN(center.getTime())) return [];
    center.setHours(0, 0, 0, 0);
    days.add(center.toDateString());
    const run: string[] = [this.toISODate(center)];
    const before = new Date(center);
    while (days.has(new Date(before.getTime() - 86400000).toDateString())) {
      before.setDate(before.getDate() - 1);
      run.unshift(this.toISODate(before));
    }
    const after = new Date(center);
    while (days.has(new Date(after.getTime() + 86400000).toDateString())) {
      after.setDate(after.getDate() + 1);
      run.push(this.toISODate(after));
    }
    return run.length > 1 ? run : [];
  }

  /** Atasan step 1: approve (request stays pending for HR-final). N+1 only. */
  async atasanApprove(id: string, userId: string, userRoles: string[] = []) {
    const db = this.prisma as any;
    const req = await db.liburRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Libur request not found');
    if (req.status !== 'pending') throw new BadRequestException('Only pending requests can be approved');
    if ((req as any).atasanStatus === 'rejected') {
      throw new BadRequestException('Request was already rejected by atasan');
    }
    // N+1: only the requester's direct parent title in the same branch
    // (or SUPERADMIN/OWNER bypass) may take the atasan step.
    await assertN1Approver(this.prisma, req.employeeId, userId, userRoles);
    const updated = await db.liburRequest.update({
      where: { id },
      data: {
        atasanStatus: 'approved',
        atasanDecidedBy: userId,
        atasanDecidedAt: new Date(),
      },
      include: { employee: { include: { user: true } } },
    });
    return {
      ...updated,
      consecutiveWarning: await this.findConsecutiveWarning(req.employeeId, req.targetPeriod, req.date),
    };
  }

  /** Atasan step 1: reject (terminal — HR cannot revive). N+1 only. */
  async atasanReject(id: string, dto: RejectLiburRequestDto, userId: string, userRoles: string[] = []) {
    const db = this.prisma as any;
    const req = await db.liburRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Libur request not found');
    if (req.status !== 'pending') throw new BadRequestException('Only pending requests can be rejected');
    // N+1: only the requester's direct parent title in the same branch
    // (or SUPERADMIN/OWNER bypass) may take the atasan step.
    await assertN1Approver(this.prisma, req.employeeId, userId, userRoles);
    return db.liburRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        atasanStatus: 'rejected',
        atasanDecidedBy: userId,
        atasanDecidedAt: new Date(),
        atasanRejectReason: dto.reason ?? null,
        rejectReason: dto.reason ?? null,
        decidedBy: userId,
        decidedAt: new Date(),
      },
      include: { employee: { include: { user: true } } },
    });
  }

  /**
   * Q3 bentrok (hard, roster-first): approving must not leave the employee's
   * shift within their division with zero staff that day. Unverifiable when the
   * roster has no submitted entries for that shift that day → allow.
   */
  private async assertNoEmptyShift(req: any) {
    const db = this.prisma as any;
    const day = new Date(req.date);
    day.setHours(0, 0, 0, 0);
    const resolved = await this.shifts.resolveShiftForDate(req.employeeId, day);
    if (!resolved.shift) return;
    const divisionId = req.employee?.divisionId ?? null;
    const entries =
      (await db.shiftRosterEntry?.findMany?.({
        where: { date: day, shiftId: resolved.shift.id, submitted: true },
        include: { employee: { select: { id: true, divisionId: true } } },
      })) ?? [];
    const onShift = (entries as any[]).filter((en) =>
      divisionId ? en.employee?.divisionId === divisionId : true,
    );
    if (onShift.length === 0) return; // roster has no coverage → unverifiable, allow
    const liburToday =
      (await db.liburRequest?.findMany?.({
        where: { date: day, status: 'approved' },
        select: { employeeId: true },
      })) ?? [];
    const liburSet = new Set((liburToday as any[]).map((r) => r.employeeId));
    const othersLeft = onShift.filter(
      (en: any) => en.employee.id !== req.employeeId && !liburSet.has(en.employee.id),
    );
    if (othersLeft.length === 0) {
      throw new ConflictException(
        `Bentrok: approving this leaves shift ${resolved.shift.code} with zero staff on ${this.toISODate(day)}`,
      );
    }
  }

  /** HR-final approve: requires atasan step-1 approval first (Q5). */
  async approveRequest(id: string, decidedBy: string) {
    const db = this.prisma as any;
    const req = await db.liburRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!req) throw new NotFoundException('Libur request not found');
    if (req.status !== 'pending') throw new BadRequestException('Only pending requests can be approved');
    if ((req as any).atasanStatus !== 'approved') {
      throw new BadRequestException('Needs atasan approval first');
    }
    await this.assertNoEmptyShift(req);

    const updated = await db.liburRequest.update({
      where: { id },
      data: { status: 'approved', decidedBy, decidedAt: new Date() },
      include: { employee: { include: { user: true } } },
    });

    // Decision 2: roster libur-day IS the approved request — plot it.
    // Upsert on @@unique([employeeId, date]); HR re-decides never duplicate.
    const reqDay = new Date(req.date);
    reqDay.setHours(0, 0, 0, 0);
    await db.shiftRosterEntry?.upsert?.({
      where: { employeeId_date: { employeeId: req.employeeId, date: reqDay } },
      update: { shiftId: null, submitted: true, submittedAt: new Date() },
      create: {
        employeeId: req.employeeId,
        date: reqDay,
        shiftId: null,
        submitted: true,
        submittedAt: new Date(),
      },
    });

    const global = await this.ensureGlobalDefault();
    const { quotaDays } = await this.resolveQuotaDays(req.employeeId, global.quotaDays);
    const used = await db.liburRequest.count({
      where: { employeeId: req.employeeId, targetPeriod: req.targetPeriod, status: 'approved' },
    });

    return {
      ...updated,
      overQuota: used > quotaDays,
      consecutiveWarning: await this.findConsecutiveWarning(req.employeeId, req.targetPeriod, req.date),
    };
  }

  /** Q5 bulk tick: approve many rows, partial-fail safe. */
  async bulkApprove(dto: BulkDecideLiburDto, decidedBy: string) {
    const approved: any[] = [];
    const failed: { id: string; reason: string }[] = [];
    for (const id of dto.ids) {
      try {
        approved.push(await this.approveRequest(id, decidedBy));
      } catch (e: any) {
        failed.push({ id, reason: e?.message ?? 'Unknown error' });
      }
    }
    return { approved, failed };
  }

  /** Q5 bulk tick: reject many rows, partial-fail safe. */
  async bulkReject(dto: BulkDecideLiburDto, decidedBy: string) {
    const rejected: any[] = [];
    const failed: { id: string; reason: string }[] = [];
    for (const id of dto.ids) {
      try {
        rejected.push(await this.rejectRequest(id, { reason: dto.reason } as any, decidedBy));
      } catch (e: any) {
        failed.push({ id, reason: e?.message ?? 'Unknown error' });
      }
    }
    return { rejected, failed };
  }

  async rejectRequest(id: string, dto: RejectLiburRequestDto, decidedBy: string) {
    const db = this.prisma as any;
    const req = await db.liburRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Libur request not found');
    if (req.status !== 'pending') throw new BadRequestException('Only pending requests can be rejected');

    return db.liburRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectReason: dto.reason ?? null,
        decidedBy,
        decidedAt: new Date(),
      },
      include: { employee: { include: { user: true } } },
    });
  }

  async cancelRequest(id: string) {
    const db = this.prisma as any;
    const req = await db.liburRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException('Libur request not found');
    if (req.status === 'cancelled') throw new BadRequestException('Request is already cancelled');

    const updated = await db.liburRequest.update({
      where: { id },
      data: { status: 'cancelled' },
      include: { employee: { include: { user: true } } },
    });

    // If we plotted the roster libur day on approval, unplot it — but only
    // when the cell still holds our null-shift plot (a later submit may own it).
    if (req.status === 'approved') {
      const reqDay = new Date(req.date);
      reqDay.setHours(0, 0, 0, 0);
      const cell = await db.shiftRosterEntry?.findUnique?.({
        where: { employeeId_date: { employeeId: req.employeeId, date: reqDay } },
      });
      if (cell && cell.shiftId === null) {
        await db.shiftRosterEntry.delete({ where: { id: cell.id } });
      }
    }
    return updated;
  }
}
