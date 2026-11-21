import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreatePositionDto } from '../dto/create-position.dto';
import { UpdatePositionDto } from '../dto/update-position.dto';
import { randomBytes } from 'crypto';

/**
 * Positions Service (IGDERP-277)
 * Job-title master — replaces Employee.position free text.
 * Staff titles (rank 6) carry a grade; L0-L5 titles never do.
 */
export const STAFF_RANK = 6;

@Injectable()
export class PositionsService {
  constructor(private prisma: PrismaService) {}

  private include = {
    division: { select: { id: true, code: true, name: true } },
    department: { select: { id: true, code: true, name: true } },
    grade: { select: { id: true, code: true, name: true, rank: true } },
    defaultRole: { select: { id: true, code: true, name: true } },
    defaultShift: { select: { id: true, code: true, name: true, clockIn: true, clockOut: true } },
    _count: { select: { employees: true } },
  };

  async findAll() {
    const positions = await this.prisma.position.findMany({
      where: { isActive: true },
      include: this.include,
      orderBy: [{ rank: 'asc' }, { name: 'asc' }],
    });
    return { data: positions, total: positions.length };
  }

  async findAllPaginated(page: number, limit: number, search?: string, rank?: number, includeInactive?: boolean) {
    const skip = (page - 1) * limit;
    const where: any = includeInactive ? {} : { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (rank !== undefined) {
      where.rank = rank;
    }
    const [positions, total] = await Promise.all([
      this.prisma.position.findMany({
        where,
        skip,
        take: limit,
        include: this.include,
        orderBy: [{ rank: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.position.count({ where }),
    ]);
    return {
      data: positions,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const position = await this.prisma.position.findUnique({
      where: { id },
      include: {
        ...this.include,
        employees: { select: { id: true, employeeCode: true }, take: 50 },
      },
    });
    if (!position) {
      throw new NotFoundException('Position not found');
    }
    return position;
  }

  private assertGradeRule(rank: number, gradeId?: string | null) {
    if (rank === STAFF_RANK && !gradeId) {
      throw new BadRequestException('Staff positions (rank 6) require a grade');
    }
    if (rank !== STAFF_RANK && gradeId) {
      throw new BadRequestException('Only staff positions (rank 6) may carry a grade');
    }
  }

  private async assertRefsExist(dto: { divisionId?: string | null; departmentId?: string | null; gradeId?: string | null; defaultRoleId?: string | null; defaultShiftId?: string | null }) {
    if (dto.divisionId) {
      const division = await this.prisma.division.findUnique({ where: { id: dto.divisionId } });
      if (!division || !division.isActive) {
        throw new BadRequestException('Division not found or inactive');
      }
    }
    if (dto.departmentId) {
      const department = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!department || !department.isActive) {
        throw new BadRequestException('Department not found or inactive');
      }
    }
    if (dto.gradeId) {
      const grade = await this.prisma.grade.findUnique({ where: { id: dto.gradeId } });
      if (!grade || !grade.isActive) {
        throw new BadRequestException('Grade not found or inactive');
      }
    }
    if (dto.defaultRoleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.defaultRoleId } });
      if (!role || !role.isActive) {
        throw new BadRequestException('Role not found or inactive');
      }
    }
    if (dto.defaultShiftId) {
      const shift = await (this.prisma as any).shift.findFirst({
        where: { id: dto.defaultShiftId, deletedAt: null },
      });
      if (!shift) {
        throw new BadRequestException('Shift not found or inactive');
      }
    }
  }

  async create(dto: CreatePositionDto) {
    const code = dto.code ?? (await this.generateCode());
    const existing = await this.prisma.position.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('Position code already exists');
    }
    this.assertGradeRule(dto.rank, dto.gradeId);
    await this.assertRefsExist(dto);
    return this.prisma.position.create({
      data: {
        code,
        name: dto.name,
        rank: dto.rank,
        divisionId: dto.divisionId,
        departmentId: dto.departmentId,
        gradeId: dto.gradeId,
        minSalary: dto.minSalary ?? null,
        defaultRoleId: dto.defaultRoleId,
        defaultShiftId: (dto as any).defaultShiftId ?? null,
        isActive: dto.isActive ?? true,
      },
      include: this.include,
    });
  }

  async update(id: string, dto: UpdatePositionDto) {
    const existing = await this.prisma.position.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Position not found');
    }
    const rank = dto.rank ?? existing.rank;
    const gradeId = dto.gradeId !== undefined ? dto.gradeId : existing.gradeId;
    this.assertGradeRule(rank, gradeId);
    await this.assertRefsExist(dto);
    return this.prisma.position.update({
      where: { id },
      data: {
        name: dto.name,
        rank: dto.rank,
        divisionId: dto.divisionId !== undefined ? dto.divisionId : undefined,
        departmentId: dto.departmentId !== undefined ? dto.departmentId : undefined,
        gradeId: dto.gradeId !== undefined ? dto.gradeId : undefined,
        minSalary: dto.minSalary !== undefined ? dto.minSalary : undefined,
        defaultRoleId: dto.defaultRoleId !== undefined ? dto.defaultRoleId : undefined,
        defaultShiftId: (dto as any).defaultShiftId !== undefined ? (dto as any).defaultShiftId : undefined,
        isActive: dto.isActive,
      },
      include: this.include,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.position.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Position not found');
    }
    if (existing._count.employees > 0) {
      throw new BadRequestException(
        'Cannot deactivate position with employees attached — move them first',
      );
    }
    await this.prisma.position.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async generateCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = `POS-${randomBytes(4).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.position.findUnique({ where: { code } });
      if (!existing) return code;
    }
    throw new BadRequestException('Failed to generate unique code after multiple attempts');
  }
}
