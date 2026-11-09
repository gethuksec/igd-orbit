import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreatePenaltyTypeDto, UpdatePenaltyTypeDto, ListPenaltyTypesDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Penalty Types Service (IGDERP-261)
 * HR master-data CRUD with soft delete
 */
@Injectable()
export class PenaltyTypesService {
  constructor(private prisma: PrismaService) {}

  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `DENDA-${random}`;

      const existing = await (this.prisma as any).penaltyType.findUnique({
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

  async findAll(query: ListPenaltyTypesDto) {
    const { page = 1, limit = 20, search, includeInactive, status } = query;

    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.PenaltyTypeWhereInput = {
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
      (this.prisma as any).penaltyType.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
      }),
      (this.prisma as any).penaltyType.count({ where }),
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
    const row = await (this.prisma as any).penaltyType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!row) {
      throw new NotFoundException('Penalty type not found');
    }

    return row;
  }

  async create(dto: CreatePenaltyTypeDto) {
    let code = (dto as any).code;
    if (!code) {
      code = await this.generateCode();
    } else {
      const existing = await (this.prisma as any).penaltyType.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Penalty type code already exists');
      }
    }
    const existingName = await (this.prisma as any).penaltyType.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (existingName) {
      throw new ConflictException('Penalty type name must be unique');
    }

    const row = await (this.prisma as any).penaltyType.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        calculation: dto.calculation ?? 'fixed',
        defaultAmount: dto.defaultAmount !== undefined ? new Decimal(dto.defaultAmount) : undefined,
        tiers: dto.tiers ?? undefined,
        priority: dto.priority,
        picScoped: dto.picScoped,
        approverRole: dto.approverRole,
        linksHolidayWork: dto.linksHolidayWork,
        isActive: true,
      },
    });


    return row;
  }

  async update(id: string, dto: UpdatePenaltyTypeDto) {
    const row = await (this.prisma as any).penaltyType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!row) {
      throw new NotFoundException('Penalty type not found');
    }
    if ((dto as any).name && (dto as any).name !== row.name) {
      const existingName = await (this.prisma as any).penaltyType.findFirst({
        where: { name: (dto as any).name, deletedAt: null, id: { not: id } },
      });
      if (existingName) {
        throw new ConflictException('Penalty type name must be unique');
      }
    }

    if ((dto as any).code && (dto as any).code !== row.code) {
      const existing = await (this.prisma as any).penaltyType.findUnique({
        where: { code: (dto as any).code },
      });
      if (existing) {
        throw new ConflictException('Penalty type code already exists');
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
    if ((dto as any).calculation !== undefined) {
      updateData.calculation = (dto as any).calculation;
    }
    if ((dto as any).priority !== undefined) {
      updateData.priority = (dto as any).priority;
    }
    if ((dto as any).picScoped !== undefined) {
      updateData.picScoped = (dto as any).picScoped;
    }
    if ((dto as any).approverRole !== undefined) {
      updateData.approverRole = (dto as any).approverRole;
    }
    if ((dto as any).linksHolidayWork !== undefined) {
      updateData.linksHolidayWork = (dto as any).linksHolidayWork;
    }
    if ((dto as any).defaultAmount !== undefined) {
      updateData.defaultAmount = dto.defaultAmount === null ? null : new Decimal(dto.defaultAmount as any);
    }
    if ((dto as any).tiers !== undefined) {
      updateData.tiers = (dto as any).tiers;
    }

    const updated = await (this.prisma as any).penaltyType.update({
      where: { id },
      data: updateData,
    });


    return updated;
  }

  async delete(id: string): Promise<void> {
    const row = await (this.prisma as any).penaltyType.findFirst({
      where: { id, deletedAt: null },
    });

    if (!row) {
      throw new NotFoundException('Penalty type not found');
    }

    await (this.prisma as any).penaltyType.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }
}
