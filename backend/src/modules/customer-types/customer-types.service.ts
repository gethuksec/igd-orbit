import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateCustomerTypeDto, UpdateCustomerTypeDto, ListCustomerTypesDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Sales Types Service
 * Handles sales type management operations
 */
@Injectable()
export class CustomerTypesService {
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

      const existing = await this.prisma.customerType.findUnique({
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
  async findAll(query: ListCustomerTypesDto) {
    const { page = 1, limit = 20, search, includeInactive, status } = query;
    
    // Ensure page and limit are numbers (fallback if transform didn't work)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.CustomerTypeWhereInput = {};

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
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.customerType.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customerType.count({ where }),
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
    const customerType = await this.prisma.customerType.findUnique({
      where: { id },
    });

    if (!customerType) {
      throw new NotFoundException('Sales type not found');
    }

    return customerType;
  }

  /**
   * Create new sales type
   * @param createCustomerTypeDto - Sales type creation data
   * @returns Created sales type
   */
  async create(createCustomerTypeDto: CreateCustomerTypeDto) {
    // Generate code if not provided
    let code = createCustomerTypeDto.code;
    if (!code) {
      code = await this.generateCode();
    } else {
      // Check code uniqueness
      const existing = await this.prisma.customerType.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Sales type code already exists');
      }
    }

    // Check name uniqueness
    const existingName = await this.prisma.customerType.findFirst({
      where: {
        name: createCustomerTypeDto.name,
        isActive: true,
      },
    });

    if (existingName) {
      throw new ConflictException('Sales type name must be unique');
    }

    // Create sales type
    const customerType = await this.prisma.customerType.create({
      data: {
        code,
        name: createCustomerTypeDto.name,
        isActive: true,
      },
    });

    return customerType;
  }

  /**
   * Update sales type
   * @param id - Sales Type ID
   * @param updateCustomerTypeDto - Sales type update data
   * @returns Updated sales type
   */
  async update(id: string, updateCustomerTypeDto: UpdateCustomerTypeDto) {
    const customerType = await this.prisma.customerType.findUnique({
      where: { id },
    });

    if (!customerType) {
      throw new NotFoundException('Sales type not found');
    }

    // Check name uniqueness if updating
    if (updateCustomerTypeDto.name && updateCustomerTypeDto.name !== customerType.name) {
      const existingName = await this.prisma.customerType.findFirst({
        where: {
          name: updateCustomerTypeDto.name,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingName) {
        throw new ConflictException('Sales type name must be unique');
      }
    }

    // Check code uniqueness if updating
    if (updateCustomerTypeDto.code && updateCustomerTypeDto.code !== customerType.code) {
      const existing = await this.prisma.customerType.findUnique({
        where: { code: updateCustomerTypeDto.code },
      });
      if (existing) {
        throw new ConflictException('Sales type code already exists');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateCustomerTypeDto.name !== undefined) {
      updateData.name = updateCustomerTypeDto.name;
    }
    if (updateCustomerTypeDto.code !== undefined) {
      updateData.code = updateCustomerTypeDto.code;
    }
    if (updateCustomerTypeDto.isActive !== undefined) {
      updateData.isActive = updateCustomerTypeDto.isActive;
    }

    // Update sales type
    const updatedCustomerType = await this.prisma.customerType.update({
      where: { id },
      data: updateData,
    });

    return updatedCustomerType;
  }

  /**
   * Soft delete sales type
   * @param id - Sales Type ID
   */
  async delete(id: string): Promise<void> {
    const customerType = await this.prisma.customerType.findUnique({
      where: { id },
    });

    if (!customerType) {
      throw new NotFoundException('Sales type not found');
    }

    // Soft delete (set isActive to false)
    await this.prisma.customerType.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
