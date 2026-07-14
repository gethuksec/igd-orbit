import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateSalesTypeDto, UpdateSalesTypeDto, ListSalesTypesDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Sales Types Service
 * Handles sales type management operations
 */
@Injectable()
export class SalesTypesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique sales type code
   * Format: SLT-{random}
   * @returns Generated code string
   */
  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `SLT-${random}`;

      const existing = await this.prisma.salesType.findUnique({
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
   * Find all sales types with search and pagination
   * @param query - Query parameters
   * @returns Paginated list of sales types
   */
  async findAll(query: ListSalesTypesDto) {
    const { page = 1, limit = 20, search } = query;
    
    // Ensure page and limit are numbers (fallback if transform didn't work)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.SalesTypeWhereInput = {
      isActive: true,
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.salesType.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
      }),
      this.prisma.salesType.count({ where }),
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
   * Find sales type by ID
   * @param id - Sales Type ID
   * @returns Sales type detail
   */
  async findById(id: string) {
    const salesType = await this.prisma.salesType.findUnique({
      where: { id },
    });

    if (!salesType) {
      throw new NotFoundException('Sales type not found');
    }

    return salesType;
  }

  /**
   * Create new sales type
   * @param createSalesTypeDto - Sales type creation data
   * @returns Created sales type
   */
  async create(createSalesTypeDto: CreateSalesTypeDto) {
    // Generate code if not provided
    let code = createSalesTypeDto.code;
    if (!code) {
      code = await this.generateCode();
    } else {
      // Check code uniqueness
      const existing = await this.prisma.salesType.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Sales type code already exists');
      }
    }

    // Check name uniqueness
    const existingName = await this.prisma.salesType.findFirst({
      where: {
        name: createSalesTypeDto.name,
        isActive: true,
      },
    });

    if (existingName) {
      throw new ConflictException('Sales type name must be unique');
    }

    // Create sales type
    const salesType = await this.prisma.salesType.create({
      data: {
        code,
        name: createSalesTypeDto.name,
        isActive: true,
      },
    });

    return salesType;
  }

  /**
   * Update sales type
   * @param id - Sales Type ID
   * @param updateSalesTypeDto - Sales type update data
   * @returns Updated sales type
   */
  async update(id: string, updateSalesTypeDto: UpdateSalesTypeDto) {
    const salesType = await this.prisma.salesType.findUnique({
      where: { id },
    });

    if (!salesType) {
      throw new NotFoundException('Sales type not found');
    }

    // Check name uniqueness if updating
    if (updateSalesTypeDto.name && updateSalesTypeDto.name !== salesType.name) {
      const existingName = await this.prisma.salesType.findFirst({
        where: {
          name: updateSalesTypeDto.name,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingName) {
        throw new ConflictException('Sales type name must be unique');
      }
    }

    // Check code uniqueness if updating
    if (updateSalesTypeDto.code && updateSalesTypeDto.code !== salesType.code) {
      const existing = await this.prisma.salesType.findUnique({
        where: { code: updateSalesTypeDto.code },
      });
      if (existing) {
        throw new ConflictException('Sales type code already exists');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateSalesTypeDto.name !== undefined) {
      updateData.name = updateSalesTypeDto.name;
    }
    if (updateSalesTypeDto.code !== undefined) {
      updateData.code = updateSalesTypeDto.code;
    }

    // Update sales type
    const updatedSalesType = await this.prisma.salesType.update({
      where: { id },
      data: updateData,
    });

    return updatedSalesType;
  }

  /**
   * Soft delete sales type
   * @param id - Sales Type ID
   */
  async delete(id: string): Promise<void> {
    const salesType = await this.prisma.salesType.findUnique({
      where: { id },
    });

    if (!salesType) {
      throw new NotFoundException('Sales type not found');
    }

    // Soft delete (set isActive to false)
    await this.prisma.salesType.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
