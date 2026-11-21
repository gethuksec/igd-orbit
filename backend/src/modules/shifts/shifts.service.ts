import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateShiftDto, UpdateShiftDto, ListShiftsDto, HH_MM_REGEX, UpsertShiftSettingDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

/** Fallback when no ShiftSetting row exists (matches migration + DTO defaults). */
export const DEFAULT_SHIFT_SETTING = {
  rosterOpenDay: 25,
  rosterCloseDay: null as number | null,
  employeeInputStartDay: 25,
};

/**
 * Shifts Service — work-schedule master data with soft delete
 */
@Injectable()
export class ShiftsService {
  constructor(private prisma: PrismaService) {}

  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `SHF-${random}`;

      const existing = await (this.prisma as any).shift.findUnique({
        where: { code },
      });

      if (!existing) {
        isUnique = true;
      }

      attempts++;
    }

    if (!isUnique) {
      throw new BadRequestException('Failed to generate unique code after multiple attempts');
    }

    return code!;
  }

  private assertValidTime(value: string, field: string) {
    if (!HH_MM_REGEX.test(value)) {
      throw new BadRequestException(`${field} must be in HH:MM format`);
    }
  }

  async findAll(query: ListShiftsDto) {
    const { page = 1, limit = 20, search, includeInactive, status } = query;

    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.ShiftWhereInput = {
      deletedAt: null,
    } as any;

    if (status === 'active') {
      (where as any).isActive = true;
    } else if (status === 'inactive') {
      (where as any).isActive = false;
    } else if (status === 'all') {
      // Show all records - no filter
    } else if (!includeInactive) {
      (where as any).isActive = true;
    }

    if (search) {
      (where as any).OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      (this.prisma as any).shift.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
        include: { _count: { select: { assignments: true } } },
      }),
      (this.prisma as any).shift.count({ where }),
    ]);

    const data = (rows as any[]).map((row) => ({
      ...row,
      activeAssignmentsCount: row._count?.assignments ?? 0,
    }));

    return {
      data,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async findById(id: string) {
    const row = await (this.prisma as any).shift.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { assignments: true } } },
    });

    if (!row) {
      throw new NotFoundException('Shift not found');
    }

    return {
      ...row,
      activeAssignmentsCount: row._count?.assignments ?? 0,
    };
  }

  async create(dto: CreateShiftDto) {
    this.assertValidTime(dto.clockIn, 'clockIn');
    this.assertValidTime(dto.clockOut, 'clockOut');

    let code = (dto as any).code;
    if (!code) {
      code = await this.generateCode();
    } else {
      const existing = await (this.prisma as any).shift.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Shift code already exists');
      }
    }

    const existingName = await (this.prisma as any).shift.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (existingName) {
      throw new ConflictException('Shift name must be unique');
    }

    const row = await (this.prisma as any).shift.create({
      data: {
        code,
        name: dto.name,
        clockIn: dto.clockIn,
        clockOut: dto.clockOut,
        overnight: dto.overnight ?? false,
        lateToleranceMin: dto.lateToleranceMin ?? 15,
        breakHours: dto.breakHours,
        color: dto.color,
        isActive: dto.isActive ?? true,
      },
    });

    return row;
  }

  async update(id: string, dto: UpdateShiftDto) {
    const row = await (this.prisma as any).shift.findFirst({
      where: { id, deletedAt: null },
    });

    if (!row) {
      throw new NotFoundException('Shift not found');
    }

    if ((dto as any).clockIn !== undefined) {
      this.assertValidTime((dto as any).clockIn, 'clockIn');
    }
    if ((dto as any).clockOut !== undefined) {
      this.assertValidTime((dto as any).clockOut, 'clockOut');
    }

    if ((dto as any).name && (dto as any).name !== row.name) {
      const existingName = await (this.prisma as any).shift.findFirst({
        where: { name: (dto as any).name, deletedAt: null, id: { not: id } },
      });
      if (existingName) {
        throw new ConflictException('Shift name must be unique');
      }
    }

    if ((dto as any).code && (dto as any).code !== row.code) {
      const existing = await (this.prisma as any).shift.findUnique({
        where: { code: (dto as any).code },
      });
      if (existing) {
        throw new ConflictException('Shift code already exists');
      }
    }

    const updateData: any = {};
    for (const key of [
      'code',
      'name',
      'clockIn',
      'clockOut',
      'overnight',
      'lateToleranceMin',
      'breakHours',
      'color',
      'isActive',
    ]) {
      if ((dto as any)[key] !== undefined) {
        updateData[key] = (dto as any)[key];
      }
    }

    const updated = await (this.prisma as any).shift.update({
      where: { id },
      data: updateData,
    });

    return updated;
  }

  async delete(id: string): Promise<void> {
    const row = await (this.prisma as any).shift.findFirst({
      where: { id, deletedAt: null },
    });

    if (!row) {
      throw new NotFoundException('Shift not found');
    }

    await (this.prisma as any).shift.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }

  // ---------- IGDERP-265 gaps: setting, roster window, shift resolution ----------
  // Release mechanism is upstream's per-date `submitted` flag (roster-first);
  // this service only parameterises the input window + resolves shifts.

  async getSetting() {
    const db = this.prisma as any;
    const row = await db.shiftSetting.findFirst();
    return row ?? { ...DEFAULT_SHIFT_SETTING, configured: false };
  }

  async upsertSetting(dto: UpsertShiftSettingDto) {
    const db = this.prisma as any;
    const existing = await db.shiftSetting.findFirst();
    const data: any = {};
    if (dto.rosterOpenDay !== undefined) data.rosterOpenDay = dto.rosterOpenDay;
    if (dto.rosterCloseDay !== undefined) data.rosterCloseDay = dto.rosterCloseDay;
    if (dto.employeeInputStartDay !== undefined) data.employeeInputStartDay = dto.employeeInputStartDay;
    if (existing) {
      return db.shiftSetting.update({ where: { id: existing.id }, data });
    }
    return db.shiftSetting.create({ data });
  }

  /**
   * Q4 gate (window only): employee roster/libur input for `period` is open
   * when today is inside the setting window. Release = upstream submitted flag.
   */
  async canEmployeeInput(_branchId: string, period: string, now = new Date()) {
    const setting = await this.getSetting();
    const openDay = setting.rosterOpenDay ?? DEFAULT_SHIFT_SETTING.rosterOpenDay;
    const startDay = setting.employeeInputStartDay ?? openDay;
    const [year, month] = period.split('-').map(Number);
    // Window: from startDay of the previous month (period-1) through closeDay/EOM.
    const prev = new Date(year, month - 2, 1);
    const windowStart = new Date(prev.getFullYear(), prev.getMonth(), startDay);
    const closeDay = setting.rosterCloseDay ?? null;
    const windowEnd =
      closeDay === null
        ? new Date(year, month - 1, 1) // first day of period month = past EOM of prev month
        : new Date(prev.getFullYear(), prev.getMonth(), closeDay + 1);
    if (now < windowStart || now >= windowEnd) {
      return { open: false as const, reason: 'outside-window' as const };
    }
    return { open: true as const, reason: 'open' as const };
  }

  /**
   * Q1+Q6 resolution (roster-first): submitted ShiftRosterEntry for the date
   * wins (null shiftId = roster libur day), else explicit assignment covering
   * `date` (weekday match), else employee live override, else title default.
   * L1-2 chart ranks are exempt (no shift → caller keeps branch-hours behavior).
   */
  async resolveShiftForDate(employeeId: string, date: Date | string) {
    const db = this.prisma as any;
    const day = date instanceof Date ? date : new Date(date);
    const weekday = ((day.getDay() + 6) % 7) + 1; // 1=Mon..7=Sun
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      include: {
        position: { select: { id: true, rank: true, defaultShiftId: true } },
        defaultShift: true,
      },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    if (employee.position && employee.position.rank <= 2) {
      return { shift: null, source: 'exempt' as const, offDate: false };
    }
    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);

    // Roster-first: a plotted entry for the exact date wins.
    const rosterEntry = await db.shiftRosterEntry?.findFirst?.({
      where: { employeeId, date: startOfDay },
      include: { shift: true },
    });
    if (rosterEntry) {
      if (!rosterEntry.shiftId) {
        return { shift: null, source: 'roster-libur' as const, offDate: true };
      }
      if (rosterEntry.shift && rosterEntry.shift.deletedAt === null) {
        return { shift: rosterEntry.shift, source: 'roster' as const, offDate: false };
      }
    }

    const candidates = await db.shiftAssignment.findMany({
      where: {
        employeeId,
        startDate: { lte: startOfDay },
        OR: [{ endDate: null }, { endDate: { gte: startOfDay } }],
      },
      include: { shift: true },
      orderBy: { startDate: 'desc' },
    });
    const hit = (candidates as any[]).find((a) => (a.weekdays ?? []).includes(weekday));
    if (hit?.shift && hit.shift.deletedAt === null) {
      const off = (hit.offDates ?? []).some(
        (d: Date | string) => new Date(d).toDateString() === startOfDay.toDateString(),
      );
      return { shift: hit.shift, source: 'assignment' as const, offDate: off };
    }
    if (employee.defaultShift && employee.defaultShift.deletedAt === null) {
      return { shift: employee.defaultShift, source: 'employee-default' as const, offDate: false };
    }
    if (employee.position?.defaultShiftId) {
      const shift = await db.shift.findFirst({
        where: { id: employee.position.defaultShiftId, deletedAt: null },
      });
      if (shift) return { shift, source: 'title-default' as const, offDate: false };
    }
    return { shift: null, source: 'none' as const, offDate: false };
  }
}
