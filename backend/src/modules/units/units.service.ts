import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateUnitDto, UpdateUnitDto, ListUnitsDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Units Service
 * Handles unit management operations
 */
@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique unit code
   * Format: UNT-{random}
   * @returns Generated code string
   */
  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `UNT-${random}`;

      const existing = await this.prisma.unit.findUnique({
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
   * Find all units with search and pagination
   * @param query - Query parameters
   * @returns Paginated list of units
   */
  async findAll(query: ListUnitsDto) {
    const { page = 1, limit = 20, search } = query;

    // Ensure page and limit are numbers (fallback if transform didn't work)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.UnitWhereInput = {
      isActive: true,
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [units, total] = await Promise.all([
      this.prisma.unit.findMany({
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
      this.prisma.unit.count({ where }),
    ]);

    return {
      data: units.map((unit) => ({
        id: unit.id,
        code: unit.code,
        name: unit.name,
        productCount: unit._count.products,
        isActive: unit.isActive,
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt,
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
   * Find unit by ID with product count
   * @param id - Unit ID
   * @returns Unit detail
   */
  async findById(id: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    return {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      productCount: unit._count.products,
      isActive: unit.isActive,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    };
  }

  /**
   * Create new unit
   * @param createUnitDto - Unit creation data
   * @returns Created unit
   */
  async create(createUnitDto: CreateUnitDto) {
    // Generate code if not provided
    let code = createUnitDto.code;
    if (!code) {
      code = await this.generateCode();
    } else {
      // Check code uniqueness
      const existing = await this.prisma.unit.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Unit code already exists');
      }
    }

    // Check name uniqueness
    const existingName = await this.prisma.unit.findFirst({
      where: {
        name: createUnitDto.name,
        isActive: true,
      },
    });

    if (existingName) {
      throw new ConflictException('Unit name must be unique');
    }

    // Prepare unit data
    const unitData: any = {
      code,
      name: createUnitDto.name,
      isActive: true,
    };

    // Create unit
    const unit = await this.prisma.unit.create({
      data: unitData,
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    return {
      id: unit.id,
      code: unit.code,
      name: unit.name,
      productCount: unit._count.products,
      isActive: unit.isActive,
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt,
    };
  }

  /**
   * Update unit
   * @param id - Unit ID
   * @param updateUnitDto - Unit update data
   * @returns Updated unit
   */
  async update(id: string, updateUnitDto: UpdateUnitDto) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    // Check name uniqueness if updating
    if (updateUnitDto.name && updateUnitDto.name !== unit.name) {
      const existingName = await this.prisma.unit.findFirst({
        where: {
          name: updateUnitDto.name,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingName) {
        throw new ConflictException('Unit name must be unique');
      }
    }

    // Check code uniqueness if updating
    if (updateUnitDto.code && updateUnitDto.code !== unit.code) {
      const existing = await this.prisma.unit.findUnique({
        where: { code: updateUnitDto.code },
      });
      if (existing) {
        throw new ConflictException('Unit code already exists');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateUnitDto.name !== undefined) {
      updateData.name = updateUnitDto.name;
    }
    if (updateUnitDto.code !== undefined) {
      updateData.code = updateUnitDto.code;
    }

    // Update unit
    const updatedUnit = await this.prisma.unit.update({
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
      id: updatedUnit.id,
      code: updatedUnit.code,
      name: updatedUnit.name,
      productCount: updatedUnit._count.products,
      isActive: updatedUnit.isActive,
      createdAt: updatedUnit.createdAt,
      updatedAt: updatedUnit.updatedAt,
    };
  }

  /**
   * Soft delete unit (check if has products)
   * @param id - Unit ID
   */
  async delete(id: string): Promise<void> {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            products: true,
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    // Check if has products
    if (unit._count.products > 0) {
      throw new BadRequestException(
        `Cannot delete unit with ${unit._count.products} product(s). Please remove or reassign products first.`,
      );
    }

    // Soft delete (set isActive to false)
    await this.prisma.unit.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
