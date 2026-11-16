import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreateDepartmentDto } from '../dto/create-department.dto';
import { UpdateDepartmentDto } from '../dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const departments = await this.prisma.department.findMany({
      where: { isActive: true },
      include: {
        parentDepartment: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    });
    return { data: departments, total: departments.length };
  }

  async findAllPaginated(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [departments, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip,
        take: limit,
        include: {
          parentDepartment: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
          _count: { select: { employees: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.department.count({ where }),
    ]);
    return {
      data: departments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        parentDepartment: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        childDepartments: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }

  async create(dto: CreateDepartmentDto) {
    const level = await this.resolveLevel(dto.parentDepartmentId, dto.level);
    const department = await this.prisma.department.create({
      data: {
        code: dto.code,
        name: dto.name,
        level,
        parentDepartmentId: dto.parentDepartmentId,
        branchId: dto.branchId,
        isActive: dto.isActive ?? true,
      },
      include: {
        parentDepartment: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Department not found');
    }
    const parentId = dto.parentDepartmentId !== undefined ? dto.parentDepartmentId : existing.parentDepartmentId;
    const level =
      dto.parentDepartmentId !== undefined || dto.level !== undefined
        ? await this.resolveLevel(parentId, dto.level)
        : undefined;
    const department = await this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name,
        level,
        parentDepartmentId: dto.parentDepartmentId,
        branchId: dto.branchId,
        isActive: dto.isActive,
      },
      include: {
        parentDepartment: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    return department;
  }

  /**
   * IGDERP-277: roots are level 1 (level 0 reserved for owner tier),
   * children must be exactly parent + 1.
   */
  private async resolveLevel(parentId: string | null | undefined, level?: number): Promise<number> {
    if (!parentId) {
      return level ?? 1;
    }
    const parent = await this.prisma.department.findUnique({ where: { id: parentId } });
    if (!parent) {
      throw new BadRequestException('Parent department not found');
    }
    const expected = parent.level + 1;
    if (level !== undefined && level !== expected) {
      throw new BadRequestException(`Child department level must be parent + 1 (${expected})`);
    }
    return expected;
  }

  async remove(id: string) {
    const existing = await this.prisma.department.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Department not found');
    }
    // Soft delete - set inactive
    await this.prisma.department.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Department deactivated successfully' };
  }
}
