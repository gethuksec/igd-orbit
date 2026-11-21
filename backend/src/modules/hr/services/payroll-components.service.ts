import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreatePayrollComponentDto } from '../dto/create-payroll-component.dto';
import { UpdatePayrollComponentDto } from '../dto/update-payroll-component.dto';
import { ListPayrollComponentsDto } from '../dto/list-payroll-components.dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Payroll Components Service (IGDERP-284)
 * Income/deduction master backing the create-period checklist + import
 * template columns. Non-denda only (denda lives in PenaltyType).
 */
const CATEGORIES = ['earning', 'deduction'];
const SOURCES = ['fixed', 'grade', 'computed', 'manual'];

@Injectable()
export class PayrollComponentsService {
  constructor(private prisma: PrismaService) {}

  async generateCode(category: string): Promise<string> {
    const prefix = category === 'deduction' ? 'POT' : 'CMP';
    for (let i = 0; i < 10; i++) {
      const code = `${prefix}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.payrollComponentMaster.findUnique({
        where: { code },
      });
      if (!existing) return code;
    }
    throw new BadRequestException('Failed to generate unique code after multiple attempts');
  }

  /**
   * Checklist query for the create-period popup: active, non-deleted,
   * optionally narrowed to one category, ordered for display.
   */
  async findAll(query: ListPayrollComponentsDto) {
    const { page = 1, limit = 20, search, includeInactive, status, category } = query;

    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.PayrollComponentMasterWhereInput = {
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

    if (category) {
      if (!CATEGORIES.includes(category)) {
        throw new BadRequestException(`Unknown category '${category}' — expected earning|deduction`);
      }
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.payrollComponentMaster.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.payrollComponentMaster.count({ where }),
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
    const row = await this.prisma.payrollComponentMaster.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Payroll component not found');
    }
    return row;
  }

  async create(dto: CreatePayrollComponentDto) {
    if (!CATEGORIES.includes(dto.category)) {
      throw new BadRequestException(`Unknown category '${dto.category}' — expected earning|deduction`);
    }
    if (dto.source !== undefined && !SOURCES.includes(dto.source)) {
      throw new BadRequestException(`Unknown source '${dto.source}' — expected fixed|grade|computed|manual`);
    }
    if (dto.source === 'grade' && dto.tiers !== undefined && (typeof dto.tiers !== 'object' || dto.tiers === null)) {
      throw new BadRequestException('Grade-source components need tiers as a grade code → amount map');
    }

    let code = dto.code;
    if (!code) {
      code = await this.generateCode(dto.category);
    } else {
      const existing = await this.prisma.payrollComponentMaster.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Payroll component code already exists');
      }
    }

    const existingName = await this.prisma.payrollComponentMaster.findFirst({
      where: { name: dto.name, deletedAt: null },
    });
    if (existingName) {
      throw new ConflictException('Payroll component name must be unique');
    }

    return this.prisma.payrollComponentMaster.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        category: dto.category,
        source: dto.source ?? 'manual',
        defaultAmount: dto.defaultAmount !== undefined ? new Decimal(dto.defaultAmount) : undefined,
        tiers: dto.tiers ?? undefined,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdatePayrollComponentDto) {
    const row = await this.prisma.payrollComponentMaster.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Payroll component not found');
    }

    if (dto.category !== undefined && !CATEGORIES.includes(dto.category)) {
      throw new BadRequestException(`Unknown category '${dto.category}' — expected earning|deduction`);
    }
    if (dto.source !== undefined && !SOURCES.includes(dto.source)) {
      throw new BadRequestException(`Unknown source '${dto.source}' — expected fixed|grade|computed|manual`);
    }
    const effectiveSource = dto.source ?? row.source;
    const effectiveTiers = dto.tiers !== undefined ? dto.tiers : (row as any).tiers;
    if (effectiveSource === 'grade' && effectiveTiers !== undefined && effectiveTiers !== null &&
        (typeof effectiveTiers !== 'object' || Array.isArray(effectiveTiers))) {
      throw new BadRequestException('Grade-source components need tiers as a grade code → amount map');
    }

    if (dto.name !== undefined && dto.name !== row.name) {
      const existingName = await this.prisma.payrollComponentMaster.findFirst({
        where: { name: dto.name, deletedAt: null, id: { not: id } },
      });
      if (existingName) {
        throw new ConflictException('Payroll component name must be unique');
      }
    }

    if (dto.code !== undefined && dto.code !== row.code) {
      const existing = await this.prisma.payrollComponentMaster.findUnique({
        where: { code: dto.code },
      });
      if (existing) {
        throw new ConflictException('Payroll component code already exists');
      }
    }

    const updateData: Prisma.PayrollComponentMasterUpdateInput = {};
    if (dto.code !== undefined) updateData.code = dto.code;
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.source !== undefined) updateData.source = dto.source;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.defaultAmount !== undefined) {
      updateData.defaultAmount = dto.defaultAmount === null ? null : new Decimal(dto.defaultAmount as any);
    }
    if (dto.tiers !== undefined) updateData.tiers = dto.tiers;

    return this.prisma.payrollComponentMaster.update({ where: { id }, data: updateData });
  }

  async remove(id: string): Promise<void> {
    const row = await this.prisma.payrollComponentMaster.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Payroll component not found');
    }
    await this.prisma.payrollComponentMaster.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
  }
}
