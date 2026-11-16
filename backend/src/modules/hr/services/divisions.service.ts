import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreateDivisionDto } from '../dto/create-division.dto';
import { UpdateDivisionDto } from '../dto/update-division.dto';
import { randomBytes } from 'crypto';

/**
 * Divisions Service (IGDERP-277)
 * Layer below Department — structure editable via departmentId.
 */
@Injectable()
export class DivisionsService {
  constructor(private prisma: PrismaService) {}

  private include = {
    department: { select: { id: true, code: true, name: true } },
    _count: { select: { employees: true, positions: true } },
  };

  async findAll() {
    const divisions = await this.prisma.division.findMany({
      where: { isActive: true },
      include: this.include,
      orderBy: { name: 'asc' },
    });
    return { data: divisions, total: divisions.length };
  }

  async findAllPaginated(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [divisions, total] = await Promise.all([
      this.prisma.division.findMany({
        where,
        skip,
        take: limit,
        include: this.include,
        orderBy: { name: 'asc' },
      }),
      this.prisma.division.count({ where }),
    ]);
    return {
      data: divisions,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const division = await this.prisma.division.findUnique({
      where: { id },
      include: {
        ...this.include,
        employees: { select: { id: true, employeeCode: true }, take: 50 },
        positions: { select: { id: true, code: true, name: true }, take: 100 },
      },
    });
    if (!division) {
      throw new NotFoundException('Division not found');
    }
    return division;
  }

  async create(dto: CreateDivisionDto) {
    const code = dto.code ?? (await this.generateCode());
    const existing = await this.prisma.division.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('Division code already exists');
    }
    const department = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });
    if (!department || !department.isActive) {
      throw new BadRequestException('Department not found or inactive');
    }
    return this.prisma.division.create({
      data: {
        code,
        name: dto.name,
        departmentId: dto.departmentId,
        isActive: dto.isActive ?? true,
      },
      include: this.include,
    });
  }

  async update(id: string, dto: UpdateDivisionDto) {
    const existing = await this.prisma.division.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Division not found');
    }
    if (dto.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!department || !department.isActive) {
        throw new BadRequestException('Department not found or inactive');
      }
    }
    return this.prisma.division.update({
      where: { id },
      data: {
        name: dto.name,
        departmentId: dto.departmentId,
        isActive: dto.isActive,
      },
      include: this.include,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.division.findUnique({
      where: { id },
      include: { _count: { select: { employees: true, positions: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Division not found');
    }
    if (existing._count.employees > 0 || existing._count.positions > 0) {
      throw new BadRequestException(
        'Cannot deactivate division with employees or positions attached — move them first',
      );
    }
    await this.prisma.division.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async generateCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = `DIV-${randomBytes(4).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.division.findUnique({ where: { code } });
      if (!existing) return code;
    }
    throw new BadRequestException('Failed to generate unique code after multiple attempts');
  }
}
