import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import {
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
  constructor(private prisma: PrismaService) {}

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
    });
  }

  async approveRequest(id: string, decidedBy: string) {
    const db = this.prisma as any;
    const req = await db.liburRequest.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!req) throw new NotFoundException('Libur request not found');
    if (req.status !== 'pending') throw new BadRequestException('Only pending requests can be approved');

    const updated = await db.liburRequest.update({
      where: { id },
      data: { status: 'approved', decidedBy, decidedAt: new Date() },
      include: { employee: { include: { user: true } } },
    });

    const global = await this.ensureGlobalDefault();
    const { quotaDays } = await this.resolveQuotaDays(req.employeeId, global.quotaDays);
    const used = await db.liburRequest.count({
      where: { employeeId: req.employeeId, targetPeriod: req.targetPeriod, status: 'approved' },
    });

    return { ...updated, overQuota: used > quotaDays };
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

    return db.liburRequest.update({
      where: { id },
      data: { status: 'cancelled' },
      include: { employee: { include: { user: true } } },
    });
  }
}
