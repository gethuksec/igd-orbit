import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class BranchesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique branch code
   * Format: BR-{random}
   * @returns Generated code string
   */
  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `BR-${random}`;

      const existing = await this.prisma.branch.findUnique({
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

  /**
   * Find all branches with pagination
   */
  async findAll(page: number = 1, limit: number = 20, search?: string, includeInactive?: boolean) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    if (search && search.trim().length > 0) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { code: { contains: search.trim(), mode: 'insensitive' } },
        { city: { contains: search.trim(), mode: 'insensitive' } },
        { province: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const [branches, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        include: {
          headOfService: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          _count: {
            select: {
              userRoles: true,
              productStocks: true,
              salesTransactions: true,
              serviceOrders: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.branch.count({ where }),
    ]);

    return {
      data: branches.map((branch) => ({
        id: branch.id,
        code: branch.code,
        name: branch.name,
        type: branch.type,
        phone: branch.phone,
        email: branch.email,
        address: branch.address,
        city: branch.city,
        province: branch.province,
        headOfServiceId: branch.headOfServiceId,
        headOfService: branch.headOfService
          ? {
              id: branch.headOfService.id,
              name: branch.headOfService.fullName || branch.headOfService.email,
              email: branch.headOfService.email,
            }
          : null,
        isActive: branch.isActive,
        isWarehouse: branch.isWarehouse,
        operatingHours: branch.operatingHours,
        userCount: branch._count.userRoles,
        productStockCount: branch._count.productStocks,
        salesTransactionCount: branch._count.salesTransactions,
        serviceOrderCount: branch._count.serviceOrders,
        createdAt: branch.createdAt,
        updatedAt: branch.updatedAt,
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
   * Find branch by ID
   */
  async findById(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        headOfService: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        _count: {
          select: {
            userRoles: true,
            productStocks: true,
            salesTransactions: true,
            serviceOrders: true,
            stockMovements: true,
            stockTransfersFrom: true,
            stockTransfersTo: true,
            stockOpnames: true,
            employees: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      type: branch.type,
      phone: branch.phone,
      email: branch.email,
      address: branch.address,
      city: branch.city,
      province: branch.province,
      headOfServiceId: branch.headOfServiceId,
      headOfService: branch.headOfService
        ? {
            id: branch.headOfService.id,
            name: branch.headOfService.fullName || branch.headOfService.email,
            email: branch.headOfService.email,
            phone: branch.headOfService.phone,
          }
        : null,
      isActive: branch.isActive,
      isWarehouse: branch.isWarehouse,
      operatingHours: branch.operatingHours,
      userCount: branch._count.userRoles,
      productStockCount: branch._count.productStocks,
      salesTransactionCount: branch._count.salesTransactions,
      serviceOrderCount: branch._count.serviceOrders,
      stockMovementCount: branch._count.stockMovements,
      stockTransferFromCount: branch._count.stockTransfersFrom,
      stockTransferToCount: branch._count.stockTransfersTo,
      stockOpnameCount: branch._count.stockOpnames,
      employeeCount: branch._count.employees,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  }

  /**
   * Create new branch
   */
  async create(createBranchDto: CreateBranchDto) {
    // Generate code if not provided
    let code: string | undefined = undefined;
    if (!createBranchDto.code) {
      code = await this.generateCode();
    } else {
      // Check code uniqueness
      const existing = await this.prisma.branch.findUnique({
        where: { code: createBranchDto.code },
      });

      if (existing) {
        throw new ConflictException('Branch code already exists');
      }
      code = createBranchDto.code;
    }

    // Check name uniqueness
    const existingName = await this.prisma.branch.findFirst({
      where: {
        name: createBranchDto.name,
        isActive: true,
      },
    });

    if (existingName) {
      throw new ConflictException('Branch name must be unique');
    }

    // Verify headOfServiceId exists and has HS role
    if (createBranchDto.headOfServiceId) {
      const headOfService = await this.prisma.user.findUnique({
        where: { id: createBranchDto.headOfServiceId },
        include: {
          userRoles: {
            where: {
              OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
            },
            include: {
              role: true,
            },
          },
        },
      });

      if (!headOfService) {
        throw new NotFoundException('Head of Service user not found');
      }

      const hasHSRole = headOfService.userRoles.some((ur) => ur.role.code === 'HS');
      if (!hasHSRole) {
        throw new BadRequestException('Selected user must have HS (Head of Store) role');
      }
    }

    const branch = await this.prisma.branch.create({
      data: {
        code,
        name: createBranchDto.name,
        type: createBranchDto.type || 'store',
        phone: createBranchDto.phone || null,
        email: createBranchDto.email || null,
        address: createBranchDto.address || null,
        city: createBranchDto.city || null,
        province: createBranchDto.province || null,
        headOfServiceId: createBranchDto.headOfServiceId,
        isActive: createBranchDto.isActive !== undefined ? createBranchDto.isActive : true,
        isWarehouse: createBranchDto.isWarehouse !== undefined ? createBranchDto.isWarehouse : false,
        operatingHours: createBranchDto.operatingHours
          ? (createBranchDto.operatingHours as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      include: {
        headOfService: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return {
      id: branch.id,
      code: branch.code,
      name: branch.name,
      type: branch.type,
      phone: branch.phone,
      email: branch.email,
      address: branch.address,
      city: branch.city,
      province: branch.province,
      headOfServiceId: branch.headOfServiceId,
      headOfService: branch.headOfService
        ? {
            id: branch.headOfService.id,
            name: branch.headOfService.fullName || branch.headOfService.email,
            email: branch.headOfService.email,
          }
        : null,
      isActive: branch.isActive,
      isWarehouse: branch.isWarehouse,
      operatingHours: branch.operatingHours,
      createdAt: branch.createdAt,
      updatedAt: branch.updatedAt,
    };
  }

  /**
   * Update branch
   */
  async update(id: string, updateBranchDto: UpdateBranchDto) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Check code uniqueness if updating code
    if (updateBranchDto.code && updateBranchDto.code !== branch.code) {
      const existing = await this.prisma.branch.findUnique({
        where: { code: updateBranchDto.code },
      });

      if (existing) {
        throw new ConflictException('Branch code already exists');
      }
    }

    // Check name uniqueness if updating name
    if (updateBranchDto.name && updateBranchDto.name !== branch.name) {
      const existingName = await this.prisma.branch.findFirst({
        where: {
          name: updateBranchDto.name,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingName) {
        throw new ConflictException('Branch name must be unique');
      }
    }

    const updateData: any = {};

    if (updateBranchDto.code !== undefined) {
      updateData.code = updateBranchDto.code;
    }
    if (updateBranchDto.name !== undefined) {
      updateData.name = updateBranchDto.name;
    }
    if (updateBranchDto.type !== undefined) {
      updateData.type = updateBranchDto.type;
    }
    if (updateBranchDto.phone !== undefined) {
      updateData.phone = updateBranchDto.phone || null;
    }
    if (updateBranchDto.email !== undefined) {
      updateData.email = updateBranchDto.email || null;
    }
    if (updateBranchDto.address !== undefined) {
      updateData.address = updateBranchDto.address || null;
    }
    if (updateBranchDto.city !== undefined) {
      updateData.city = updateBranchDto.city || null;
    }
    if (updateBranchDto.province !== undefined) {
      updateData.province = updateBranchDto.province || null;
    }
    if (updateBranchDto.headOfServiceId !== undefined) {
      updateData.headOfServiceId = updateBranchDto.headOfServiceId || null;
    }
    if (updateBranchDto.isActive !== undefined) {
      updateData.isActive = updateBranchDto.isActive;
    }
    if (updateBranchDto.isWarehouse !== undefined) {
      updateData.isWarehouse = updateBranchDto.isWarehouse;
    }
    if (updateBranchDto.operatingHours !== undefined) {
      updateData.operatingHours = updateBranchDto.operatingHours
        ? (updateBranchDto.operatingHours as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    const updated = await this.prisma.branch.update({
      where: { id },
      data: updateData,
      include: {
        headOfService: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      type: updated.type,
      phone: updated.phone,
      email: updated.email,
      address: updated.address,
      city: updated.city,
      province: updated.province,
      headOfServiceId: updated.headOfServiceId,
      headOfService: updated.headOfService
        ? {
            id: updated.headOfService.id,
            name: updated.headOfService.fullName || updated.headOfService.email,
            email: updated.headOfService.email,
          }
        : null,
      isActive: updated.isActive,
      isWarehouse: updated.isWarehouse,
      operatingHours: updated.operatingHours,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Get detailed statistics for a branch
   */
  async getDetailedStats(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Total stock quantity (sum of quantityAvailable - quantityReserved)
    const stockAggregation = await this.prisma.productStock.aggregate({
      where: { branchId: id },
      _sum: {
        quantityAvailable: true,
        quantityReserved: true,
        quantityDamaged: true,
      },
      _count: {
        id: true,
      },
    });

    const totalStockQuantity =
      (stockAggregation._sum.quantityAvailable?.toNumber() || 0) -
      (stockAggregation._sum.quantityReserved?.toNumber() || 0);
    const totalAvailableStock = stockAggregation._sum.quantityAvailable?.toNumber() || 0;
    const totalReservedStock = stockAggregation._sum.quantityReserved?.toNumber() || 0;
    const totalDamagedStock = stockAggregation._sum.quantityDamaged?.toNumber() || 0;
    const totalProductStockRecords = stockAggregation._count.id || 0;

    // Sales transactions statistics
    const salesStats = await this.prisma.salesTransaction.aggregate({
      where: { branchId: id },
      _count: {
        id: true,
      },
      _sum: {
        total: true,
        subtotal: true,
        discountAmount: true,
        taxAmount: true,
      },
    });

    const completedSalesStats = await this.prisma.salesTransaction.aggregate({
      where: {
        branchId: id,
        status: 'completed',
      },
      _count: {
        id: true,
      },
      _sum: {
        total: true,
      },
    });

    // Service orders statistics
    const serviceStats = await this.prisma.serviceOrder.aggregate({
      where: { branchId: id },
      _count: {
        id: true,
      },
      _sum: {
        totalPrice: true,
        laborCost: true,
        partsCost: true,
        discountAmount: true,
        taxAmount: true,
      },
    });

    const completedServiceStats = await this.prisma.serviceOrder.aggregate({
      where: {
        branchId: id,
        status: { in: ['completed', 'delivered'] },
      },
      _count: {
        id: true,
      },
      _sum: {
        totalPrice: true,
      },
    });

    // Stock movements count
    const stockMovementCount = await this.prisma.stockMovement.count({
      where: { branchId: id },
    });

    // Stock transfers (from and to)
    const stockTransferFromCount = await this.prisma.stockTransfer.count({
      where: { fromBranchId: id },
    });

    const stockTransferToCount = await this.prisma.stockTransfer.count({
      where: { toBranchId: id },
    });

    // Stock opnames count
    const stockOpnameCount = await this.prisma.stockOpname.count({
      where: { branchId: id },
    });

    // Employees count
    const employeeCount = await this.prisma.employee.count({
      where: { branchId: id },
    });

    // User roles count
    const userRoleCount = await this.prisma.userRole.count({
      where: { branchId: id },
    });

    return {
      stock: {
        totalQuantity: totalStockQuantity,
        totalAvailable: totalAvailableStock,
        totalReserved: totalReservedStock,
        totalDamaged: totalDamagedStock,
        productStockRecords: totalProductStockRecords,
      },
      sales: {
        totalTransactions: salesStats._count.id || 0,
        completedTransactions: completedSalesStats._count.id || 0,
        totalRevenue: salesStats._sum.total?.toNumber() || 0,
        completedRevenue: completedSalesStats._sum.total?.toNumber() || 0,
        totalSubtotal: salesStats._sum.subtotal?.toNumber() || 0,
        totalDiscount: salesStats._sum.discountAmount?.toNumber() || 0,
        totalTax: salesStats._sum.taxAmount?.toNumber() || 0,
      },
      service: {
        totalOrders: serviceStats._count.id || 0,
        completedOrders: completedServiceStats._count.id || 0,
        totalRevenue: serviceStats._sum.totalPrice?.toNumber() || 0,
        completedRevenue: completedServiceStats._sum.totalPrice?.toNumber() || 0,
        totalLaborCost: serviceStats._sum.laborCost?.toNumber() || 0,
        totalPartsCost: serviceStats._sum.partsCost?.toNumber() || 0,
        totalDiscount: serviceStats._sum.discountAmount?.toNumber() || 0,
        totalTax: serviceStats._sum.taxAmount?.toNumber() || 0,
      },
      inventory: {
        stockMovements: stockMovementCount,
        stockTransfersFrom: stockTransferFromCount,
        stockTransfersTo: stockTransferToCount,
        stockOpnames: stockOpnameCount,
      },
      users: {
        userRoles: userRoleCount,
        employees: employeeCount,
      },
    };
  }

  /**
   * Get users with HS (Head of Service) role
   * Used for dropdown selection in branch form
   */
  async getHSUsers() {
    const hsUsers = await this.prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: {
              code: 'HS',
            },
          },
        },
        deletedAt: null, // Only active users
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
      },
      orderBy: {
        fullName: 'asc',
      },
    });

    return hsUsers.map((user) => ({
      id: user.id,
      name: user.fullName || user.email, // Use fullName or fallback to email
      email: user.email,
      phone: user.phone || undefined,
    }));
  }

  /**
   * Delete branch (soft delete)
   */
  async delete(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            userRoles: true,
            productStocks: true,
            salesTransactions: true,
            serviceOrders: true,
          },
        },
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Check if has related data
    const hasRelatedData =
      branch._count.userRoles > 0 ||
      branch._count.productStocks > 0 ||
      branch._count.salesTransactions > 0 ||
      branch._count.serviceOrders > 0;

    if (hasRelatedData) {
      throw new BadRequestException(
        'Cannot delete branch with existing users, stock, transactions, or service orders. Please reassign or remove related data first.',
      );
    }

    // Soft delete (set isActive to false)
    return this.prisma.branch.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

