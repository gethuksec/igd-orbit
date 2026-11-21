import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import {
  CreateShiftAssignmentDto,
  UpdateShiftAssignmentDto,
  ListShiftAssignmentsDto,
} from './dto';

interface AssignmentRange {
  id?: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  weekdays: number[];
}

/**
 * Shift Assignments Service — employee ↔ shift scheduling with overlap guard
 */
@Injectable()
export class ShiftAssignmentsService {
  constructor(private prisma: PrismaService) {}

  private toDate(value: Date | string): Date {
    return value instanceof Date ? value : new Date(value);
  }

  private assertValidWeekdays(weekdays: any) {
    if (!Array.isArray(weekdays) || weekdays.length === 0) {
      throw new BadRequestException('weekdays must be a non-empty array');
    }
    for (const day of weekdays) {
      if (!Number.isInteger(day) || day < 1 || day > 7) {
        throw new BadRequestException('weekdays must contain integers 1..7');
      }
    }
  }

  private assertValidRange(startDate: Date | string, endDate?: Date | string | null) {
    if (endDate !== undefined && endDate !== null) {
      const start = this.toDate(startDate).getTime();
      const end = this.toDate(endDate).getTime();
      if (Number.isNaN(start) || Number.isNaN(end)) {
        throw new BadRequestException('Invalid startDate or endDate');
      }
      if (end < start) {
        throw new BadRequestException('endDate must not be before startDate');
      }
    }
  }

  /** null endDate = open-ended (infinite). Weekdays must intersect. */
  private rangesOverlap(a: AssignmentRange, b: AssignmentRange): boolean {
    const aStart = this.toDate(a.startDate).getTime();
    const bStart = this.toDate(b.startDate).getTime();
    const aEnd = a.endDate ? this.toDate(a.endDate).getTime() : Infinity;
    const bEnd = b.endDate ? this.toDate(b.endDate).getTime() : Infinity;

    const datesOverlap = aStart <= bEnd && bStart <= aEnd;
    if (!datesOverlap) return false;

    return a.weekdays.some((day) => b.weekdays.includes(day));
  }

  private async assertNoOverlap(candidate: AssignmentRange, employeeId: string) {
    const existing = await (this.prisma as any).shiftAssignment.findMany({
      where: { employeeId },
    });

    for (const row of existing as any[]) {
      if (candidate.id && row.id === candidate.id) continue;
      if (
        this.rangesOverlap(candidate, {
          startDate: row.startDate,
          endDate: row.endDate,
          weekdays: row.weekdays,
        })
      ) {
        throw new ConflictException(
          'Shift assignment overlaps with an existing assignment for this employee',
        );
      }
    }
  }

  private async assertEmployeeAndShift(employeeId: string, shiftId: string) {
    const employee = await (this.prisma as any).employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    const shift = await (this.prisma as any).shift.findFirst({
      where: { id: shiftId, deletedAt: null },
    });
    if (!shift) {
      throw new NotFoundException('Shift not found');
    }
  }

  async findAll(query: ListShiftAssignmentsDto) {
    const { page = 1, limit = 20, employeeId, shiftId, activeOn, search } = query;

    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (shiftId) where.shiftId = shiftId;
    if (activeOn) {
      const day = new Date(activeOn);
      where.AND = [
        { startDate: { lte: day } },
        { OR: [{ endDate: null }, { endDate: { gte: day } }] },
      ];
    }
    if (search) {
      where.note = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).shiftAssignment.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { startDate: 'desc' },
        include: { employee: true, shift: true },
      }),
      (this.prisma as any).shiftAssignment.count({ where }),
    ]);

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
    const row = await (this.prisma as any).shiftAssignment.findUnique({
      where: { id },
      include: { employee: true, shift: true },
    });
    if (!row) {
      throw new NotFoundException('Shift assignment not found');
    }
    return row;
  }

  async create(dto: CreateShiftAssignmentDto) {
    this.assertValidWeekdays((dto as any).weekdays);
    this.assertValidRange(dto.startDate, dto.endDate);
    await this.assertEmployeeAndShift(dto.employeeId, dto.shiftId);
    await this.assertNoOverlap(
      {
        startDate: dto.startDate,
        endDate: dto.endDate ?? null,
        weekdays: (dto as any).weekdays,
      },
      dto.employeeId,
    );

    const row = await (this.prisma as any).shiftAssignment.create({
      data: {
        employeeId: dto.employeeId,
        shiftId: dto.shiftId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        weekdays: (dto as any).weekdays,
        offDates: ((dto as any).offDates ?? []).map((d: string) => new Date(d)),
        note: (dto as any).note,
      },
      include: { employee: true, shift: true },
    });

    return row;
  }

  async update(id: string, dto: UpdateShiftAssignmentDto) {
    const row = await (this.prisma as any).shiftAssignment.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Shift assignment not found');
    }

    const employeeId = (dto as any).employeeId ?? row.employeeId;
    const shiftId = (dto as any).shiftId ?? row.shiftId;
    const startDate = (dto as any).startDate ?? row.startDate;
    const endDate = (dto as any).endDate !== undefined ? (dto as any).endDate : row.endDate;
    const weekdays = (dto as any).weekdays ?? row.weekdays;

    this.assertValidWeekdays(weekdays);
    this.assertValidRange(startDate, endDate);
    await this.assertEmployeeAndShift(employeeId, shiftId);
    await this.assertNoOverlap({ id, startDate, endDate, weekdays }, employeeId);

    const updateData: any = {};
    if ((dto as any).employeeId !== undefined) updateData.employeeId = (dto as any).employeeId;
    if ((dto as any).shiftId !== undefined) updateData.shiftId = (dto as any).shiftId;
    if ((dto as any).startDate !== undefined) updateData.startDate = new Date((dto as any).startDate);
    if ((dto as any).endDate !== undefined) {
      updateData.endDate = (dto as any).endDate ? new Date((dto as any).endDate) : null;
    }
    if ((dto as any).weekdays !== undefined) updateData.weekdays = (dto as any).weekdays;
    if ((dto as any).offDates !== undefined) {
      updateData.offDates = ((dto as any).offDates ?? []).map((d: string) => new Date(d));
    }
    if ((dto as any).note !== undefined) updateData.note = (dto as any).note;

    const updated = await (this.prisma as any).shiftAssignment.update({
      where: { id },
      data: updateData,
      include: { employee: true, shift: true },
    });

    return updated;
  }

  async delete(id: string): Promise<void> {
    const row = await (this.prisma as any).shiftAssignment.findUnique({
      where: { id },
    });
    if (!row) {
      throw new NotFoundException('Shift assignment not found');
    }
    await (this.prisma as any).shiftAssignment.delete({ where: { id } });
  }
}
