import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignPermissionDto,
  CloneRoleDto,
} from './dto';
import { Prisma } from '@prisma/client';

/**
 * Roles Service
 * Handles role management operations
 * 
 * Access Control: SUPERADMIN only (enforced in controller)
 */
@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find all roles
   */
  async findAll(query?: {
    page?: number;
    limit?: number;
    search?: string;
    isActive?: boolean;
  }) {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
    } = query || {};

    const skip = (page - 1) * limit;
    const where: Prisma.RoleWhereInput = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [roles, total] = await Promise.all([
      this.prisma.role.findMany({
        where,
        include: {
          _count: {
            select: {
              userRoles: {
                where: {
                  OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
                },
              },
            },
          },
        },
        skip,
        take: limit,
        orderBy: { level: 'asc' },
      }),
      this.prisma.role.count({ where }),
    ]);

    return {
      data: roles.map((role) => ({
        ...role,
        userCount: role._count.userRoles,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find role by ID
   */
  async findById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            userRoles: {
              where: {
                OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      ...role,
      userCount: role._count.userRoles,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        module: rp.permission.module,
        submodule: rp.permission.submodule,
        action: rp.permission.action,
        maxAmount: rp.maxAmount?.toNumber(),
        requiresApproval: rp.requiresApproval,
        conditions: rp.conditions,
      })),
    };
  }

  /**
   * Find role by code
   */
  async findByCode(code: string) {
    const role = await this.prisma.role.findUnique({
      where: { code },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  /**
   * Create new role
   */
  async create(dto: CreateRoleDto, _createdBy: string) {
    // Check if code already exists
    const existing = await this.prisma.role.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(`Role with code '${dto.code}' already exists`);
    }

    const role = await this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        level: dto.level,
        isSystemRole: dto.isSystemRole || false,
      },
    });

    return role;
  }

  /**
   * Update role
   */
  async update(id: string, dto: UpdateRoleDto, _updatedBy: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Prevent modifying system roles
    if (role.isSystemRole && (dto.level !== undefined || dto.isActive === false)) {
      throw new BadRequestException('Cannot modify system role properties');
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        level: dto.level,
        isActive: dto.isActive,
      },
    });

    return updated;
  }

  /**
   * Soft delete role (set isActive to false)
   */
  async softDelete(id: string, _deletedBy: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userRoles: {
              where: {
                OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Prevent deleting system roles
    if (role.isSystemRole) {
      throw new BadRequestException('Cannot delete system role');
    }

    // Check if role is assigned to any users
    if (role._count.userRoles > 0) {
      throw new BadRequestException(
        'Cannot delete role that is assigned to users. Deactivate it instead.',
      );
    }

    // Soft delete by setting isActive to false
    return this.prisma.role.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Assign permission to role
   */
  async assignPermission(
    roleId: string,
    dto: AssignPermissionDto,
    _assignedBy: string,
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const permission = await this.prisma.permission.findUnique({
      where: { id: dto.permissionId },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // Check if already assigned
    const existing = await this.prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId: dto.permissionId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('Permission already assigned to role');
    }

    const rolePermission = await this.prisma.rolePermission.create({
      data: {
        roleId,
        permissionId: dto.permissionId,
        maxAmount: dto.maxAmount ? new Prisma.Decimal(dto.maxAmount) : null,
        requiresApproval: dto.requiresApproval || false,
        conditions: dto.conditions !== undefined ? (dto.conditions as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      include: {
        permission: true,
      },
    });

    return rolePermission;
  }

  /**
   * Remove permission from role
   */
  async removePermission(roleId: string, permissionId: string, _removedBy: string) {
    const rolePermission = await this.prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });

    if (!rolePermission) {
      throw new NotFoundException('Permission not assigned to role');
    }

    await this.prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId,
        },
      },
    });

    return { success: true };
  }

  /**
   * Clone role
   */
  async cloneRole(roleId: string, dto: CloneRoleDto, _clonedBy: string) {
    const sourceRole = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!sourceRole) {
      throw new NotFoundException('Source role not found');
    }

    // Check if new code already exists
    const existing = await this.prisma.role.findUnique({
      where: { code: dto.newCode },
    });

    if (existing) {
      throw new ConflictException(`Role with code '${dto.newCode}' already exists`);
    }

    // Create new role
    const newRole = await this.prisma.role.create({
      data: {
        code: dto.newCode,
        name: dto.newName || `${sourceRole.name} (Copy)`,
        description: sourceRole.description,
        level: sourceRole.level,
        isSystemRole: false, // Cloned roles are never system roles
      },
    });

    // Copy permissions
    if (sourceRole.rolePermissions.length > 0) {
      await this.prisma.rolePermission.createMany({
        data: sourceRole.rolePermissions.map((rp) => ({
          roleId: newRole.id,
          permissionId: rp.permissionId,
          maxAmount: rp.maxAmount,
          requiresApproval: rp.requiresApproval,
          conditions: rp.conditions === null ? Prisma.JsonNull : rp.conditions,
        })),
      });
    }

    return newRole;
  }
}

