import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateWarehouseDto, UpdateWarehouseDto, ListWarehousesDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Warehouses Service
 * Handles warehouse management operations (D2 — outlet-owned warehouses)
 */
@Injectable()
export class WarehousesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique warehouse code
   * Format: WH-{random}
   * @returns Generated code string
   */
  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `WH-${random}`;

      const existing = await this.prisma.warehouse.findUnique({
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

  private outletSelect = {
    id: true,
    code: true,
    name: true,
  } as const;

  /**
   * Find all warehouses with search and pagination
   * @param query - Query parameters
   * @returns Paginated list of warehouses (with outlet info)
   */
  async findAll(query: ListWarehousesDto) {
    const { page = 1, limit = 20, search, includeInactive, status, outletId } = query;

    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.WarehouseWhereInput = {};

    // Apply status filter
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    } else if (status === 'all') {
      // Show all records - no filter
    } else if (!includeInactive) {
      // Default: active only (backward compatible)
      where.isActive = true;
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Outlet filter
    if (outletId) {
      where.outletId = outletId;
    }

    const [data, total] = await Promise.all([
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
        include: { outlet: { select: this.outletSelect } },
      }),
      this.prisma.warehouse.count({ where }),
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

  /**
   * Find active warehouses (flat list for POS/Smart Repair dropdowns — D2)
   * @param outletId - Optional filter by parent outlet
   */
  async findActive(outletId?: string) {
    return this.prisma.warehouse.findMany({
      where: {
        isActive: true,
        ...(outletId ? { outletId } : {}),
      },
      select: { id: true, code: true, name: true, outletId: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Find warehouse by ID
   * @param id - Warehouse ID
   * @returns Warehouse detail (with outlet info)
   */
  async findById(id: string) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
      include: { outlet: { select: this.outletSelect } },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    return warehouse;
  }

  /**
   * Create new warehouse
   * @param dto - Warehouse creation data
   * @returns Created warehouse
   */
  async create(dto: CreateWarehouseDto) {
    // Verify outlet exists (branches are the outlets — decision #33)
    const outlet = await this.prisma.branch.findUnique({
      where: { id: dto.outletId },
    });
    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }

    // Generate code if not provided
    let code = dto.code;
    if (!code) {
      code = await this.generateCode();
    } else {
      const existing = await this.prisma.warehouse.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Warehouse code already exists');
      }
    }

    // Check name uniqueness (among active warehouses)
    const existingName = await this.prisma.warehouse.findFirst({
      where: {
        name: dto.name,
        isActive: true,
      },
    });

    if (existingName) {
      throw new ConflictException('Warehouse name must be unique');
    }

    // Create warehouse
    const warehouse = await this.prisma.warehouse.create({
      data: {
        code,
        name: dto.name,
        outletId: dto.outletId,
        city: dto.city,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        contactPerson: dto.contactPerson,
        mobilePhone: dto.mobilePhone,
        isActive: dto.isActive !== false,
      },
    });

    return warehouse;
  }

  /**
   * Update warehouse
   * @param id - Warehouse ID
   * @param dto - Warehouse update data
   * @returns Updated warehouse
   */
  async update(id: string, dto: UpdateWarehouseDto) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    // Verify outlet exists if changing it
    if (dto.outletId && dto.outletId !== warehouse.outletId) {
      const outlet = await this.prisma.branch.findUnique({
        where: { id: dto.outletId },
      });
      if (!outlet) {
        throw new NotFoundException('Outlet not found');
      }
    }

    // Check name uniqueness if updating
    if (dto.name && dto.name !== warehouse.name) {
      const existingName = await this.prisma.warehouse.findFirst({
        where: {
          name: dto.name,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingName) {
        throw new ConflictException('Warehouse name must be unique');
      }
    }

    // Check code uniqueness if updating
    if (dto.code && dto.code !== warehouse.code) {
      const existing = await this.prisma.warehouse.findUnique({
        where: { code: dto.code },
      });
      if (existing) {
        throw new ConflictException('Warehouse code already exists');
      }
    }

    // Prepare update data
    const updateData: Prisma.WarehouseUpdateInput = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.code !== undefined) updateData.code = dto.code;
    if (dto.outletId !== undefined) updateData.outlet = { connect: { id: dto.outletId } };
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.contactPerson !== undefined) updateData.contactPerson = dto.contactPerson;
    if (dto.mobilePhone !== undefined) updateData.mobilePhone = dto.mobilePhone;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const updatedWarehouse = await this.prisma.warehouse.update({
      where: { id },
      data: updateData,
    });

    return updatedWarehouse;
  }

  /**
   * Soft delete warehouse
   * @param id - Warehouse ID
   */
  async delete(id: string): Promise<void> {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id },
    });

    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }

    // D2 guard: block deactivate if referenced by transactions/service orders.
    // (D8 extends this to stock rows once warehouse-level stock lands.)
    const [txCount, soCount] = await Promise.all([
      this.prisma.salesTransaction.count({ where: { warehouseId: id } }),
      this.prisma.serviceOrder.count({ where: { warehouseId: id } }),
    ]);

    if (txCount > 0 || soCount > 0) {
      throw new BadRequestException(
        `Warehouse has ${txCount} transaction(s) and ${soCount} service order(s) — cannot be deleted`,
      );
    }

    // Soft delete (set isActive to false)
    await this.prisma.warehouse.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
