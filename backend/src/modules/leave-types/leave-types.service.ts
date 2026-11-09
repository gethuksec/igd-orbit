import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto, ListLeaveTypesDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Leave Types Service (IGDERP-261)
 * HR master-data CRUD with soft delete
 */
@Injectable()
export class LeaveTypesService {
  constructor(private prisma: PrismaService) {}

  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `LVT-${random}`;

      const existing = await (this.prisma as any).leaveType.findUnique({
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

  async findAll(query: ListLeaveTypesDto) {
    const { page = 1, limit = 20, search, includeInactive, status } = query;

    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.LeaveTypeWhereInput = {
      deletedAt: null,
    };

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    } else if (status === 'all') {
      // Show all records - no filter
    } else if (!includeInactive) {
      where.isActive = true;
    }

    if (search) {
      where.OR = [{ name: { contains: search, mode: 'insensitive' } }, { code: { contains: search, mode: 'insensitive' } }];
    }

    const [data, total] = await Promise.all([
      (this.prisma as any).leaveType.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
      }),
      (this.prisma as any).leaveType.count({ where }),
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
    const row = await (this.prisma as any).leaveType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!row) {
      throw new NotFoundException('Leave type not found');
    }

    return row;
  }

  async create(dto: CreateLeaveTypeDto) {
    let code = (dto as any).code;
    if (!code) {
      code = await this.generateCode();
    } else {
      const existing = await (this.prisma as any).leaveType.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Leave type code already exists');
      }
    }
    const existingName = await (this.prisma as any).leaveType.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (existingName) {
      throw new ConflictException('Leave type name must be unique');
    }

    const row = await (this.prisma as any).leaveType.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        isPaid: dto.isPaid,
        quotaDays: dto.quotaDays,
        maxApplyDelayDays: dto.maxApplyDelayDays,
        maxRequestsPerMonth: dto.maxRequestsPerMonth,
        minTenureMonths: dto.minTenureMonths,
        requiresAttachment: dto.requiresAttachment,
        isActive: true,
      },
    });


    return row;
  }

  async update(id: string, dto: UpdateLeaveTypeDto) {
    const row = await (this.prisma as any).leaveType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!row) {
      throw new NotFoundException('Leave type not found');
    }
    if ((dto as any).name && (dto as any).name !== row.name) {
      const existingName = await (this.prisma as any).leaveType.findFirst({
        where: { name: (dto as any).name, deletedAt: null, id: { not: id } },
      });
      if (existingName) {
        throw new ConflictException('Leave type name must be unique');
      }
    }

    if ((dto as any).code && (dto as any).code !== row.code) {
      const existing = await (this.prisma as any).leaveType.findUnique({
        where: { code: (dto as any).code },
      });
      if (existing) {
        throw new ConflictException('Leave type code already exists');
      }
    }

    const updateData: any = {};
    if (dto.code !== undefined) {
      updateData.code = dto.code;
    }
    if ((dto as any).name !== undefined) {
      updateData.name = (dto as any).name;
    }
    if ((dto as any).description !== undefined) {
      updateData.description = (dto as any).description;
    }
    if ((dto as any).isPaid !== undefined) {
      updateData.isPaid = (dto as any).isPaid;
    }
    if ((dto as any).quotaDays !== undefined) {
      updateData.quotaDays = (dto as any).quotaDays;
    }
    if ((dto as any).maxApplyDelayDays !== undefined) {
      updateData.maxApplyDelayDays = (dto as any).maxApplyDelayDays;
    }
    if ((dto as any).maxRequestsPerMonth !== undefined) {
      updateData.maxRequestsPerMonth = (dto as any).maxRequestsPerMonth;
    }
    if ((dto as any).minTenureMonths !== undefined) {
      updateData.minTenureMonths = (dto as any).minTenureMonths;
    }
    if ((dto as any).requiresAttachment !== undefined) {
      updateData.requiresAttachment = (dto as any).requiresAttachment;
    }

    const updated = await (this.prisma as any).leaveType.update({
      where: { id },
      data: updateData,
    });


    return updated;
  }

  async delete(id: string): Promise<void> {
    const row = await (this.prisma as any).leaveType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!row) {
      throw new NotFoundException('Leave type not found');
    }
    const inUse = await (this.prisma as any).leaveRequest.count({ where: { leaveTypeId: id } });
    if (inUse > 0) {
      throw new ConflictException(`Cannot delete: still referenced by ${inUse} leave requests`);
    }

    await (this.prisma as any).leaveType.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }
}
