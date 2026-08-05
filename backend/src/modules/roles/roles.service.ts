import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  CloneRoleDto,
} from './dto';
import { Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { bumpPermissionVersion } from '../../shared/utils/permissions.util';

/**
 * Roles Service
 * Handles role management operations
 * 
 * Access Control: SUPERADMIN only (enforced in controller)
 */
@Injectable()
export class RolesService {
  constructor(
    private prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * D-PERM: bump permission version for EVERY user assigned this role.
   * Role-level changes (defaultPermissions, level, isActive) affect all holders.
   */
  private async bumpAllRoleHolders(roleId: string): Promise<void> {
    const holders = await this.prisma.userBranch.findMany({
      where: { roleId },
      select: { userId: true },
    });
    await Promise.all(
      holders.map((h) => bumpPermissionVersion(this.redis, h.userId)),
    );
  }

  /**
   * Find all roles
   */
  async findAll(query?: {
    page?: number | string;
    limit?: number | string;
    search?: string;
    isActive?: boolean | string;
  }) {
    // Ensure page and limit are numbers (handle string conversion from query params)
    const pageNum = typeof query?.page === 'string' ? parseInt(query.page, 10) : (query?.page || 1);
    const limitNum = typeof query?.limit === 'string' ? parseInt(query.limit, 10) : (query?.limit || 20);
    const search = query?.search;
    
    // Convert isActive from string to boolean if needed
    let isActive: boolean | undefined;
    if (query?.isActive !== undefined) {
      if (typeof query.isActive === 'string') {
        isActive = query.isActive === 'true' || query.isActive === '1';
      } else {
        isActive = query.isActive;
      }
    }

    const skip = (pageNum - 1) * limitNum;
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
          parentRole: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          _count: {
            select: {
              userBranches: true,
            },
          },
        },
        skip,
        take: limitNum,
        orderBy: { level: 'asc' },
      }),
      this.prisma.role.count({ where }),
    ]);

    return {
      data: roles.map((role) => {
        // Remove _count from the response and include userCount separately
        const { _count, ...roleData } = role as any;
        return {
          ...roleData,
          userCount: _count?.userBranches || 0,
        };
      }),
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
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
        parentRole: {
          select: {
            id: true,
            code: true,
            name: true,
            level: true,
          },
        },
        childRoles: {
          select: {
            id: true,
            code: true,
            name: true,
            level: true,
          },
        },
        _count: {
          select: {
            userBranches: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return {
      ...role,
      userCount: role._count.userBranches,
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

    // D-SEC: SUPERADMIN is a reserved code — a duplicate role would grant the
    // SUPERADMIN bypass (RolesGuard checks role-code membership) → privilege escalation.
    if (dto.code === 'SUPERADMIN') {
      throw new ConflictException("Role code 'SUPERADMIN' is reserved and cannot be created");
    }

    // Validate parent role if provided
    if (dto.parentRoleId) {
      const parentRole = await this.prisma.role.findUnique({
        where: { id: dto.parentRoleId },
      });
      if (!parentRole) {
        throw new NotFoundException('Parent role not found');
      }
    }

    const role = await this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        level: dto.level,
        isSystemRole: dto.isSystemRole || false,
        parentRoleId: dto.parentRoleId || null,
        defaultPermissions: dto.defaultPermissions || [],
      },
    });

    return role;
  }

  /**
   * Update role
   */
  async update(id: string, dto: UpdateRoleDto, _updatedBy: string, user?: any) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const userRoles = user?.roles || [];
    const isSuperAdmin = userRoles.includes('SUPERADMIN');

    // Prevent modifying system roles (unless SUPERADMIN)
    if (!isSuperAdmin && role.isSystemRole && (dto.level !== undefined || dto.isActive === false)) {
      throw new BadRequestException('Cannot modify system role properties');
    }

    // D-SEC: SUPERADMIN role is FULLY immutable via API — DB-only edits.
    // Reject any field change attempt (permissions, name, description, level, status, parent).
    if (role.code === 'SUPERADMIN') {
      const hasChanges = [
        dto.name,
        dto.description,
        dto.level,
        dto.isActive,
        dto.parentRoleId,
        dto.defaultPermissions,
      ].some((v) => v !== undefined);
      if (hasChanges) {
        throw new BadRequestException(
          'SUPERADMIN role is immutable and can only be edited directly in the database',
        );
      }
    }

    // Validate parent role if provided (prevent circular references)
    if (dto.parentRoleId !== undefined) {
      if (dto.parentRoleId === id) {
        throw new BadRequestException('Role cannot be its own parent');
      }
      if (dto.parentRoleId) {
        const parentRole = await this.prisma.role.findUnique({
          where: { id: dto.parentRoleId },
        });
        if (!parentRole) {
          throw new NotFoundException('Parent role not found');
        }
        // Check for circular reference
        let currentParentId = parentRole.parentRoleId;
        while (currentParentId) {
          if (currentParentId === id) {
            throw new BadRequestException('Circular reference detected in role hierarchy');
          }
          const currentParent = await this.prisma.role.findUnique({
            where: { id: currentParentId },
            select: { parentRoleId: true },
          });
          currentParentId = currentParent?.parentRoleId || null;
        }
      }
    }

    const updated = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        level: dto.level,
        isActive: dto.isActive,
        parentRoleId: dto.parentRoleId !== undefined ? (dto.parentRoleId || null) : undefined,
        defaultPermissions: dto.defaultPermissions,
      },
    });

    // D-PERM: role permissions/level/active changed → invalidate all holders' JWTs
    await this.bumpAllRoleHolders(id);

    return updated;
  }

  /**
   * Soft delete role (set isActive to false)
   */
  async softDelete(id: string, _deletedBy: string, user?: any) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userBranches: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // D-SEC: the SUPERADMIN role itself cannot be deactivated — total lockout risk
    if (role.code === 'SUPERADMIN') {
      throw new BadRequestException('SUPERADMIN role cannot be deactivated');
    }

    const userRoles = user?.roles || [];
    const isSuperAdmin = userRoles.includes('SUPERADMIN');

    // Prevent deleting system roles (unless SUPERADMIN)
    if (!isSuperAdmin && role.isSystemRole) {
      throw new BadRequestException('Cannot delete system role');
    }

    // Check if role is assigned to any users (unless SUPERADMIN)
    if (!isSuperAdmin && role._count.userBranches > 0) {
      throw new BadRequestException(
        'Cannot delete role that is assigned to users. Deactivate it instead.',
      );
    }

    // Soft delete by setting isActive to false
    const updated = await this.prisma.role.update({
      where: { id },
      data: { isActive: false },
    });

    // D-PERM: role deactivated → invalidate all holders' JWTs
    await this.bumpAllRoleHolders(id);

    return updated;
  }

  /**
   * Clone role
   */
  async cloneRole(roleId: string, dto: CloneRoleDto, _clonedBy: string) {
    const sourceRole = await this.prisma.role.findUnique({
      where: { id: roleId },
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
    // Create new role — D1: clone carries defaultPermissions (junction is gone)
    const newRole = await this.prisma.role.create({
      data: {
        code: dto.newCode,
        name: dto.newName || `${sourceRole.name} (Copy)`,
        description: sourceRole.description,
        level: sourceRole.level,
        isSystemRole: false, // Cloned roles are never system roles
        defaultPermissions: sourceRole.defaultPermissions,
      },
    });

    return newRole;
  }
}

