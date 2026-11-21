import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateShiftDto, UpdateShiftDto, ListShiftsDto, HH_MM_REGEX } from './dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

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
}
