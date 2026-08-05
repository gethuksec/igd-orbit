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
  AssignPermissionDto,
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
    const holders = await this.prisma.userRole.findMany({
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
              userRoles: {
                where: {
                  OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
                },
              },
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
          userCount: _count?.userRoles || 0,
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
        rolePermissions: {
          include: {
            permission: true,
          },
        },
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

    // SUPERADMIN permissions are immutable — anyone (including SUPERADMIN) cannot change them
    if (role.code === 'SUPERADMIN' && dto.defaultPermissions !== undefined) {
      throw new BadRequestException('SUPERADMIN permissions are immutable and cannot be changed');
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

    const userRoles = user?.roles || [];
    const isSuperAdmin = userRoles.includes('SUPERADMIN');

    // Prevent deleting system roles (unless SUPERADMIN)
    if (!isSuperAdmin && role.isSystemRole) {
      throw new BadRequestException('Cannot delete system role');
    }

    // Check if role is assigned to any users (unless SUPERADMIN)
    if (!isSuperAdmin && role._count.userRoles > 0) {
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

    // D-PERM: legacy junction changed → still part of merge until D1 → bump holders
    await this.bumpAllRoleHolders(roleId);

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

    // D-PERM: legacy junction changed → still part of merge until D1 → bump holders
    await this.bumpAllRoleHolders(roleId);

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

  /**
   * Get menu access for a role
   */
  async getMenuAccess(roleId: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const menuAccess = await this.prisma.roleMenuAccess.findMany({
      where: { roleId },
    });

    return { menus: menuAccess };
  }

  /**
   * Update menu access for a role
   */
  async updateMenuAccess(roleId: string, menuKeys: string[], _updatedBy: string) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Define menu structure with labels and paths
    const menuStructure: Record<string, { label: string; path?: string }> = {
      dashboard: { label: 'Dashboard', path: '/dashboard' },
      'master_data': { label: 'Master Data' },
      'master_data.customers': { label: 'Pelanggan', path: '/customers' },
      'master_data.products': { label: 'Produk', path: '/products' },
      'master_data.suppliers': { label: 'Supplier', path: '/suppliers' },
      'master_data.categories': { label: 'Kategori', path: '/categories' },
      'master_data.brands': { label: 'Brand', path: '/brands' },
      'master_data.service_types': { label: 'Layanan', path: '/service-types' },
      sales: { label: 'Penjualan' },
      'sales.pos': { label: 'POS', path: '/sales/pos' },
      'sales.history': { label: 'Riwayat Penjualan', path: '/sales/history' },
      'sales.returns': { label: 'Retur Penjualan', path: '/sales/returns' },
      service: { label: 'Servis' },
      'service.orders': { label: 'Semua Service Order', path: '/service-orders' },
      'service.my_orders': { label: 'Service Saya', path: '/service-orders/my' },
      'service.new': { label: 'Tambah Service', path: '/service-orders/new' },
      'service.returns': { label: 'Retur & Komplain', path: '/service-returns' },
      inventory: { label: 'Gudang' },
      'inventory.stock': { label: 'Stok', path: '/inventory/stock' },
      'inventory.transfer': { label: 'Transfer Stok', path: '/inventory/transfer' },
      'inventory.opname': { label: 'Stock Opname', path: '/inventory/opname' },
      'inventory.adjustment': { label: 'Stock Adjustment', path: '/inventory/adjustment' },
      'inventory.movements': { label: 'Riwayat Perpindahan', path: '/inventory/movements' },
      'inventory.alerts': { label: 'Peringatan Stok Rendah', path: '/inventory/alerts' },
      finance: { label: 'Keuangan' },
      'finance.coa': { label: 'Chart of Accounts', path: '/finance/coa' },
      'finance.journal': { label: 'Jurnal Umum', path: '/finance/journal' },
      'finance.expenses': { label: 'Pengeluaran', path: '/finance/expenses' },
      'finance.petty_cash': { label: 'Petty Cash', path: '/finance/petty-cash' },
      'finance.ar': { label: 'Accounts Receivable', path: '/finance/ar' },
      'finance.reports': { label: 'Laporan Keuangan', path: '/finance/reports' },
      purchasing: { label: 'Pembelian' },
      'purchasing.suppliers': { label: 'Supplier', path: '/purchasing/suppliers' },
      'purchasing.po': { label: 'Purchase Order', path: '/purchasing/po' },
      'purchasing.goods_receipt': { label: 'Goods Receipt', path: '/purchasing/goods-receipt' },
      hr: { label: 'Karyawan' },
      'hr.employees': { label: 'Data Karyawan', path: '/hr/employees' },
      'hr.attendance': { label: 'Absensi', path: '/hr/attendance' },
      'hr.leave': { label: 'Cuti', path: '/hr/leave' },
      'hr.payroll': { label: 'Payroll', path: '/hr/payroll' },
      'hr.kpi': { label: 'KPI', path: '/hr/kpi' },
      branches: { label: 'Cabang', path: '/branches' },
      'users_roles': { label: 'User & Role' },
      'users_roles.users': { label: 'Users', path: '/users' },
      'users_roles.roles': { label: 'Roles', path: '/roles' },
    };

    // Delete all existing menu access
    await this.prisma.roleMenuAccess.deleteMany({
      where: { roleId },
    });

    // Create new menu access entries
    const menuAccessEntries = menuKeys.map((menuKey) => {
      const menuInfo = menuStructure[menuKey] || { label: menuKey, path: undefined };
      return {
        roleId,
        menuKey,
        menuPath: menuInfo.path || null,
        menuLabel: menuInfo.label,
        isEnabled: true,
      };
    });

    if (menuAccessEntries.length > 0) {
      await this.prisma.roleMenuAccess.createMany({
        data: menuAccessEntries,
      });
    }

    return { success: true, count: menuAccessEntries.length };
  }
}

