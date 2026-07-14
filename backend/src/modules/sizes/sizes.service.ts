import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateSizeDto, UpdateSizeDto, ListSizesDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Sizes Service
 * Handles size management operations
 */
@Injectable()
export class SizesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique size code
   * Format: SIZ-{random}
   * @returns Generated code string
   */
  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `SIZ-${random}`;

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

    // Apply status filter
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    } else if (!includeInactive) {
      // Default: active only (backward compatible)
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

    return {
      data: sizes.map((size) => ({
        id: size.id,
        code: size.code,
        name: size.name,
        productCount: size._count.products,
        isActive: size.isActive,
        createdAt: size.createdAt,
        updatedAt: size.updatedAt,
      })),
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
    const size = await this.prisma.size.findUnique({
      where: { id },
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
        isActive: true,
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
    const size = await this.prisma.size.findUnique({
      where: { id },
    });

    if (!size) {
      throw new NotFoundException('Size not found');
    }

    // Check name uniqueness if updating
    if (updateSizeDto.name && updateSizeDto.name !== size.name) {
      const existingName = await this.prisma.size.findFirst({
        where: {
          name: updateSizeDto.name,
          isActive: true,
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
    const size = await this.prisma.size.findUnique({
      where: { id },
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
      },
    });
  }
}
