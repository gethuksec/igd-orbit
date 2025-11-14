import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateBrandDto, UpdateBrandDto, ListBrandsDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Brands Service
 * Handles brand management operations
 */
@Injectable()
export class BrandsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique brand code
   * Format: BRD-{random}
   * @returns Generated code string
   */
  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `BRD-${random}`;

      const existing = await this.prisma.brand.findUnique({
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
   * Find all brands with search and pagination
   * @param query - Query parameters
   * @returns Paginated list of brands
   */
  async findAll(query: ListBrandsDto) {
    const { page = 1, limit = 20, search } = query;

    const skip = (page - 1) * limit;
    const where: Prisma.BrandWhereInput = {
      isActive: true,
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [brands, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              products: true,
            },
          },
        },
      }),
      this.prisma.brand.count({ where }),
    ]);

    return {
      data: brands.map((brand) => ({
        id: brand.id,
        code: brand.code,
        name: brand.name,
        description: brand.description,
        logoUrl: brand.logoUrl,
        website: (brand as any).website || null,
        productCount: brand._count.products,
        isActive: brand.isActive,
        createdAt: brand.createdAt,
        updatedAt: brand.updatedAt,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find brand by ID with product count
   * @param id - Brand ID
   * @returns Brand detail
   */
  async findById(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    return {
      id: brand.id,
      code: brand.code,
      name: brand.name,
      description: brand.description,
      logoUrl: brand.logoUrl,
      website: (brand as any).website || null,
      productCount: brand._count.products,
      isActive: brand.isActive,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  }

  /**
   * Create new brand
   * @param createBrandDto - Brand creation data
   * @returns Created brand
   */
  async create(createBrandDto: CreateBrandDto) {
    // Generate code if not provided
    let code = createBrandDto.code;
    if (!code) {
      code = await this.generateCode();
    } else {
      // Check code uniqueness
      const existing = await this.prisma.brand.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Brand code already exists');
      }
    }

    // Check name uniqueness
    const existingName = await this.prisma.brand.findFirst({
      where: {
        name: createBrandDto.name,
        isActive: true,
      },
    });

    if (existingName) {
      throw new ConflictException('Brand name must be unique');
    }

    // Prepare brand data
    const brandData: any = {
      code,
      name: createBrandDto.name,
      description: createBrandDto.description || null,
      logoUrl: createBrandDto.logoUrl || null,
      isActive: true,
    };

    if (createBrandDto.website) {
      brandData.website = createBrandDto.website;
    }

    // Create brand
    const brand = await this.prisma.brand.create({
      data: brandData,
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return {
      id: brand.id,
      code: brand.code,
      name: brand.name,
      description: brand.description,
      logoUrl: brand.logoUrl,
      website: (brand as any).website || null,
      productCount: brand._count.products,
      isActive: brand.isActive,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  }

  /**
   * Update brand
   * @param id - Brand ID
   * @param updateBrandDto - Brand update data
   * @returns Updated brand
   */
  async update(id: string, updateBrandDto: UpdateBrandDto) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Check name uniqueness if updating
    if (updateBrandDto.name && updateBrandDto.name !== brand.name) {
      const existingName = await this.prisma.brand.findFirst({
        where: {
          name: updateBrandDto.name,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingName) {
        throw new ConflictException('Brand name must be unique');
      }
    }

    // Check code uniqueness if updating
    if (updateBrandDto.code && updateBrandDto.code !== brand.code) {
      const existing = await this.prisma.brand.findUnique({
        where: { code: updateBrandDto.code },
      });
      if (existing) {
        throw new ConflictException('Brand code already exists');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateBrandDto.name !== undefined) {
      updateData.name = updateBrandDto.name;
    }
    if (updateBrandDto.description !== undefined) {
      updateData.description = updateBrandDto.description || null;
    }
    if (updateBrandDto.logoUrl !== undefined) {
      updateData.logoUrl = updateBrandDto.logoUrl || null;
    }
    if (updateBrandDto.website !== undefined) {
      updateData.website = updateBrandDto.website || null;
    }
    if (updateBrandDto.code !== undefined) {
      updateData.code = updateBrandDto.code;
    }
    // isActive is not in UpdateBrandDto, but can be added if needed
    // if (updateBrandDto.isActive !== undefined) {
    //   updateData.isActive = updateBrandDto.isActive;
    // }

    // Update brand
    const updatedBrand = await this.prisma.brand.update({
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
      id: updatedBrand.id,
      code: updatedBrand.code,
      name: updatedBrand.name,
      description: updatedBrand.description,
      logoUrl: updatedBrand.logoUrl,
      website: (updatedBrand as any).website || null,
      productCount: updatedBrand._count.products,
      isActive: updatedBrand.isActive,
      createdAt: updatedBrand.createdAt,
      updatedAt: updatedBrand.updatedAt,
    };
  }

  /**
   * Soft delete brand (check if has products)
   * @param id - Brand ID
   */
  async delete(id: string): Promise<void> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    // Check if has products
    if (brand._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete brand with ${brand._count.products} product(s). Please remove or reassign products first.`,
      );
    }

    // Soft delete (set isActive to false)
    await this.prisma.brand.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}

