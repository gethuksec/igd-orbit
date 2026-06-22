import { Injectable, NotFoundException } from '@nestjs/common';
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
        { description: { contains: search, mode: 'insensitive' } },
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
    const department = await this.prisma.department.create({
      data: {
        name: dto.name,
        description: dto.description,
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
    const department = await this.prisma.department.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
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
