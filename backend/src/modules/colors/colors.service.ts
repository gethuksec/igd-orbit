import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateColorDto, UpdateColorDto, ListColorsDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Colors Service
 * Handles color management operations
 */
@Injectable()
export class ColorsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique color code
   * Format: CLR-{random}
   * @returns Generated code string
   */
  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `CLR-${random}`;

      const existing = await this.prisma.color.findUnique({
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
   * Find all colors with search and pagination
   * @param query - Query parameters
   * @returns Paginated list of colors
   */
  async findAll(query: ListColorsDto) {
    const { page = 1, limit = 20, search } = query;

    // Ensure page and limit are numbers (fallback if transform didn't work)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.ColorWhereInput = {
      isActive: true,
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [colors, total] = await Promise.all([
      this.prisma.color.findMany({
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
      this.prisma.color.count({ where }),
    ]);

    return {
      data: colors.map((color) => ({
        id: color.id,
        code: color.code,
        name: color.name,
        notes: (color as any).notes || null,
        productCount: color._count.products,
        isActive: color.isActive,
        createdAt: color.createdAt,
        updatedAt: color.updatedAt,
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
   * Find color by ID with product count
   * @param id - Color ID
   * @returns Color detail
   */
  async findById(id: string) {
    const color = await this.prisma.color.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!color) {
      throw new NotFoundException('Color not found');
    }

    return {
      id: color.id,
      code: color.code,
      name: color.name,
      notes: (color as any).notes || null,
      productCount: color._count.products,
      isActive: color.isActive,
      createdAt: color.createdAt,
      updatedAt: color.updatedAt,
    };
  }

  /**
   * Create new color
   * @param createColorDto - Color creation data
   * @returns Created color
   */
  async create(createColorDto: CreateColorDto) {
    // Generate code if not provided
    let code = createColorDto.code;
    if (!code) {
      code = await this.generateCode();
    } else {
      // Check code uniqueness
      const existing = await this.prisma.color.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Color code already exists');
      }
    }

    // Check name uniqueness
    const existingName = await this.prisma.color.findFirst({
      where: {
        name: createColorDto.name,
        isActive: true,
      },
    });

    if (existingName) {
      throw new ConflictException('Color name must be unique');
    }

    // Prepare color data
    const colorData: any = {
      code,
      name: createColorDto.name,
      notes: createColorDto.notes || null,
      isActive: true,
    };

    // Create color
    const color = await this.prisma.color.create({
      data: colorData,
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return {
      id: color.id,
      code: color.code,
      name: color.name,
      notes: (color as any).notes || null,
      productCount: color._count.products,
      isActive: color.isActive,
      createdAt: color.createdAt,
      updatedAt: color.updatedAt,
    };
  }

  /**
   * Update color
   * @param id - Color ID
   * @param updateColorDto - Color update data
   * @returns Updated color
   */
  async update(id: string, updateColorDto: UpdateColorDto) {
    const color = await this.prisma.color.findUnique({
      where: { id },
    });

    if (!color) {
      throw new NotFoundException('Color not found');
    }

    // Check name uniqueness if updating
    if (updateColorDto.name && updateColorDto.name !== color.name) {
      const existingName = await this.prisma.color.findFirst({
        where: {
          name: updateColorDto.name,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingName) {
        throw new ConflictException('Color name must be unique');
      }
    }

    // Check code uniqueness if updating
    if (updateColorDto.code && updateColorDto.code !== color.code) {
      const existing = await this.prisma.color.findUnique({
        where: { code: updateColorDto.code },
      });
      if (existing) {
        throw new ConflictException('Color code already exists');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateColorDto.name !== undefined) {
      updateData.name = updateColorDto.name;
    }
    if (updateColorDto.notes !== undefined) {
      updateData.notes = updateColorDto.notes || null;
    }
    if (updateColorDto.code !== undefined) {
      updateData.code = updateColorDto.code;
    }

    // Update color
    const updatedColor = await this.prisma.color.update({
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
      id: updatedColor.id,
      code: updatedColor.code,
      name: updatedColor.name,
      notes: (updatedColor as any).notes || null,
      productCount: updatedColor._count.products,
      isActive: updatedColor.isActive,
      createdAt: updatedColor.createdAt,
      updatedAt: updatedColor.updatedAt,
    };
  }

  /**
   * Soft delete color (check if has products)
   * @param id - Color ID
   */
  async delete(id: string): Promise<void> {
    const color = await this.prisma.color.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!color) {
      throw new NotFoundException('Color not found');
    }

    // Check if has products
    if (color._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete color with ${color._count.products} product(s). Please remove or reassign products first.`,
      );
    }

    // Soft delete (set isActive to false)
    await this.prisma.color.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
