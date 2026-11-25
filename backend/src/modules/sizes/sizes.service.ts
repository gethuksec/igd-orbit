import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateSizeDto, UpdateSizeDto, ListSizesDto } from './dto';
import { Prisma } from '@prisma/client';
import { generateMasterCode } from '../../common/master-code.util';

/**
 * Sizes Service
 * Handles size management operations
 */
@Injectable()
export class SizesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique size code
   * Format: flat 10-char alphanumeric [A-Z0-9] (IGDERP-316)
   * @returns Generated code string
   */
  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      code = generateMasterCode();

      const existing = await this.prisma.size.findUnique({
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
   * Find all sizes with search and pagination
   * @param query - Query parameters
   * @returns Paginated list of sizes
   */
  async findAll(query: ListSizesDto) {
    const { page = 1, limit = 20, search, includeInactive, status } = query;

    // Ensure page and limit are numbers (fallback if transform didn't work)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.SizeWhereInput = {};

    // Apply status filter (status-aware deletedAt, cf. products.service.ts:
    // soft-delete sets isActive=false AND deletedAt=now, so the deletedAt
    // clause must follow the requested status instead of hardcoded null)
    if (status === 'inactive') {
      where.deletedAt = { not: null };
      where.isActive = false;
    } else if (status === 'all') {
      // Show all records - no filter
      where.deletedAt = undefined;
    } else if (status === 'active') {
      where.deletedAt = null;
      where.isActive = true;
    } else if (includeInactive) {
      // Legacy flag: show all records including inactive
      where.deletedAt = undefined;
    } else {
      // Default: active only (backward compatible)
      where.deletedAt = null;
      where.isActive = true;
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [sizes, total] = await Promise.all([
      this.prisma.size.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      }),
      this.prisma.size.count({ where }),
    ]);

    const rows = sizes.map((size) => ({
      id: size.id,
      code: size.code,
      name: size.name,
      productCount: size._count.products,
      totalSku: size._count.products,
      totalStock: 0,
      isActive: size.isActive,
      createdAt: size.createdAt,
      updatedAt: size.updatedAt,
    }));

    // Enhancement-only aggregate: totalStock (sum of quantityAvailable over
    // the size's products). Degrades to 0 on query failure.
    try {
      const ids = rows.map((r) => r.id);
      if (ids.length > 0) {
        const products = await this.prisma.product.findMany({
          where: { sizeId: { in: ids } },
          select: { id: true, sizeId: true },
        });
        const productIds = products.map((p) => p.id);
        const stockByProduct = new Map<string, number>();
        if (productIds.length > 0) {
          const sums = await this.prisma.productStock.groupBy({
            by: ['productId'],
            where: { productId: { in: productIds } },
            _sum: { quantityAvailable: true },
          });
          for (const s of sums) {
            stockByProduct.set(s.productId, Number(s._sum.quantityAvailable ?? 0));
          }
        }
        const stockBySize = new Map<string, number>();
        for (const p of products) {
          if (!p.sizeId) continue;
          stockBySize.set(
            p.sizeId,
            (stockBySize.get(p.sizeId) ?? 0) + (stockByProduct.get(p.id) ?? 0),
          );
        }
        for (const r of rows) {
          r.totalStock = stockBySize.get(r.id) ?? 0;
        }
      }
    } catch (e) {
      console.warn('sizes.findAll aggregates degraded:', (e as Error)?.message || e);
    }

    return {
      data: rows,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Find size by ID with product count
   * @param id - Size ID
   * @returns Size detail
   */
  async findById(id: string) {
    const size = await this.prisma.size.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!size) {
      throw new NotFoundException('Size not found');
    }

    return {
      id: size.id,
      code: size.code,
      name: size.name,
      productCount: size._count.products,
      isActive: size.isActive,
      createdAt: size.createdAt,
      updatedAt: size.updatedAt,
    };
  }

  /**
   * Create new size
   * @param createSizeDto - Size creation data
   * @returns Created size
   */
  async create(createSizeDto: CreateSizeDto) {
    // Generate code if not provided
    let code = createSizeDto.code;
    if (!code) {
      code = await this.generateCode();
    } else {
      // Check code uniqueness
      const existing = await this.prisma.size.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Size code already exists');
      }
    }

    // Check name uniqueness
    const existingName = await this.prisma.size.findFirst({
      where: {
        name: createSizeDto.name,
        deletedAt: null,
      },
    });

    if (existingName) {
      throw new ConflictException('Size name must be unique');
    }

    // Prepare size data
    const sizeData: any = {
      code,
      name: createSizeDto.name,
      isActive: true,
    };

    // Create size
    const size = await this.prisma.size.create({
      data: sizeData,
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return {
      id: size.id,
      code: size.code,
      name: size.name,
      productCount: size._count.products,
      isActive: size.isActive,
      createdAt: size.createdAt,
      updatedAt: size.updatedAt,
    };
  }

  /**
   * Update size
   * @param id - Size ID
   * @param updateSizeDto - Size update data
   * @returns Updated size
   */
  async update(id: string, updateSizeDto: UpdateSizeDto) {
    const size = await this.prisma.size.findFirst({
      where: { id, deletedAt: null },
    });

    if (!size) {
      throw new NotFoundException('Size not found');
    }

    // Check name uniqueness if updating
    if (updateSizeDto.name && updateSizeDto.name !== size.name) {
      const existingName = await this.prisma.size.findFirst({
        where: {
          name: updateSizeDto.name,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (existingName) {
        throw new ConflictException('Size name must be unique');
      }
    }

    // Check code uniqueness if updating
    if (updateSizeDto.code && updateSizeDto.code !== size.code) {
      const existing = await this.prisma.size.findUnique({
        where: { code: updateSizeDto.code },
      });
      if (existing) {
        throw new ConflictException('Size code already exists');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateSizeDto.name !== undefined) {
      updateData.name = updateSizeDto.name;
    }
    if (updateSizeDto.code !== undefined) {
      updateData.code = updateSizeDto.code;
    }
    if (updateSizeDto.isActive !== undefined) {
      updateData.isActive = updateSizeDto.isActive;
    }

    // Update size
    const updatedSize = await this.prisma.size.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return {
      id: updatedSize.id,
      code: updatedSize.code,
      name: updatedSize.name,
      productCount: updatedSize._count.products,
      isActive: updatedSize.isActive,
      createdAt: updatedSize.createdAt,
      updatedAt: updatedSize.updatedAt,
    };
  }

  /**
   * Soft delete size (check if has products)
   * @param id - Size ID
   */
  async delete(id: string): Promise<void> {
    const size = await this.prisma.size.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!size) {
      throw new NotFoundException('Size not found');
    }

    // Check if has products
    if (size._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete size with ${size._count.products} product(s). Please remove or reassign products first.`,
      );
    }

    // Soft delete (set isActive to false)
    await this.prisma.size.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }
}
