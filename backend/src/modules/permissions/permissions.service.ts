import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';

/**
 * Permissions Service
 * Handles permission management operations
 * 
 * Permissions are typically read-only (created by system/migrations)
 * Only SUPERADMIN can create/update permissions
 */
@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find all permissions, grouped by module
   */
  async findAllGrouped() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [
        { module: 'asc' },
        { submodule: 'asc' },
        { action: 'asc' },
      ],
    });

    // Group by module -> submodule -> action
    const grouped: Record<
      string,
      Record<string, Array<{ id: string; action: string; description: string | null }>>
    > = {};

    for (const perm of permissions) {
      const module = perm.module;
      const submodule = perm.submodule || '*';

      if (!grouped[module]) {
        grouped[module] = {};
      }

      if (!grouped[module][submodule]) {
        grouped[module][submodule] = [];
      }

      grouped[module][submodule].push({
        id: perm.id,
        action: perm.action,
        description: perm.description,
      });
    }

    return grouped;
  }

  /**
   * Find all permissions (flat list)
   */
  async findAll(query?: {
    page?: number;
    limit?: number;
    module?: string;
    submodule?: string;
    action?: string;
  }) {
    const { page = 1, limit = 100, module, submodule, action } = query || {};

    const skip = (page - 1) * limit;
    const where: any = {};

    if (module) {
      where.module = { contains: module, mode: 'insensitive' };
    }

    if (submodule) {
      where.submodule = submodule === '*' ? null : { contains: submodule, mode: 'insensitive' };
    }

    if (action) {
      where.action = { contains: action, mode: 'insensitive' };
    }

    const [permissions, total] = await Promise.all([
      this.prisma.permission.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { module: 'asc' },
          { submodule: 'asc' },
          { action: 'asc' },
        ],
      }),
      this.prisma.permission.count({ where }),
    ]);

    return {
      data: permissions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find permission by ID
   */
  async findById(id: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }

  /**
   * Create permission (SUPERADMIN only)
   */
  async create(data: {
    module: string;
    submodule?: string;
    action: string;
    description?: string;
  }) {
    // Normalize submodule: undefined -> null for Prisma
    const submodule = data.submodule ?? null;
    
    // Check if already exists - use findFirst for nullable unique constraint
    const existing = await this.prisma.permission.findFirst({
      where: {
        module: data.module,
        submodule: submodule,
        action: data.action,
      },
    });

    if (existing) {
      return existing; // Return existing if already created
    }

    const permission = await this.prisma.permission.create({
      data: {
        module: data.module,
        submodule: submodule,
        action: data.action,
        description: data.description,
      },
    });

    return permission;
  }

  /**
   * Update permission (SUPERADMIN only)
   */
  async update(id: string, data: { description?: string }) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
    });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    // Only allow updating description
    const updated = await this.prisma.permission.update({
      where: { id },
      data: {
        description: data.description,
      },
    });

    return updated;
  }
}

