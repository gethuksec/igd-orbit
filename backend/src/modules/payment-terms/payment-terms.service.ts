import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreatePaymentTermDto, UpdatePaymentTermDto, ListPaymentTermsDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Payment Terms Service
 * Handles payment term master data operations
 */
@Injectable()
export class PaymentTermsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique payment term code
   * Format: PYM-{random}
   * @returns Generated code string
   */
  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `PYM-${random}`;

      const existing = await this.prisma.paymentTerm.findUnique({
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
   * Find all payment terms with search and pagination
   * @param query - Query parameters
   * @returns Paginated list of payment terms
   */
  async findAll(query: ListPaymentTermsDto) {
    const { page = 1, limit = 20, search, includeInactive, status } = query;

    // Ensure page and limit are numbers (fallback if transform didn't work)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.PaymentTermWhereInput = {};

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
      this.prisma.paymentTerm.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
      }),
      this.prisma.paymentTerm.count({ where }),
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
   * Find payment term by ID
   * @param id - Payment Term ID
   * @returns Payment term detail
   */
  async findById(id: string) {
    const paymentTerm = await this.prisma.paymentTerm.findUnique({
      where: { id },
    });

    if (!paymentTerm) {
      throw new NotFoundException('Payment term not found');
    }

    return paymentTerm;
  }

  /**
   * Create new payment term
   * @param createPaymentTermDto - Payment term creation data
   * @returns Created payment term
   */
  async create(createPaymentTermDto: CreatePaymentTermDto) {
    // Generate code if not provided
    let code = createPaymentTermDto.code;
    if (!code) {
      code = await this.generateCode();
    } else {
      // Check code uniqueness
      const existing = await this.prisma.paymentTerm.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Payment term code already exists');
      }
    }

    // Check name uniqueness
    const existingName = await this.prisma.paymentTerm.findFirst({
      where: {
        name: createPaymentTermDto.name,
        isActive: true,
      },
    });

    if (existingName) {
      throw new ConflictException('Payment term name must be unique');
    }

    // Create payment term
    const paymentTerm = await this.prisma.paymentTerm.create({
      data: {
        code,
        name: createPaymentTermDto.name,
        days: createPaymentTermDto.days ?? 0,
        isActive: true,
      },
    });

    return paymentTerm;
  }

  /**
   * Update payment term
   * @param id - Payment Term ID
   * @param updatePaymentTermDto - Payment term update data
   * @returns Updated payment term
   */
  async update(id: string, updatePaymentTermDto: UpdatePaymentTermDto) {
    const paymentTerm = await this.prisma.paymentTerm.findUnique({
      where: { id },
    });

    if (!paymentTerm) {
      throw new NotFoundException('Payment term not found');
    }

    // Check name uniqueness if updating
    if (updatePaymentTermDto.name && updatePaymentTermDto.name !== paymentTerm.name) {
      const existingName = await this.prisma.paymentTerm.findFirst({
        where: {
          name: updatePaymentTermDto.name,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingName) {
        throw new ConflictException('Payment term name must be unique');
      }
    }

    // Check code uniqueness if updating
    if (updatePaymentTermDto.code && updatePaymentTermDto.code !== paymentTerm.code) {
      const existing = await this.prisma.paymentTerm.findUnique({
        where: { code: updatePaymentTermDto.code },
      });
      if (existing) {
        throw new ConflictException('Payment term code already exists');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updatePaymentTermDto.name !== undefined) {
      updateData.name = updatePaymentTermDto.name;
    }
    if (updatePaymentTermDto.code !== undefined) {
      updateData.code = updatePaymentTermDto.code;
    }
    if (updatePaymentTermDto.days !== undefined) {
      updateData.days = updatePaymentTermDto.days;
    }
    if (updatePaymentTermDto.isActive !== undefined) {
      updateData.isActive = updatePaymentTermDto.isActive;
    }

    // Update payment term
    const updatedPaymentTerm = await this.prisma.paymentTerm.update({
      where: { id },
      data: updateData,
    });

    return updatedPaymentTerm;
  }

  /**
   * Soft delete payment term
   * @param id - Payment Term ID
   */
  async delete(id: string): Promise<void> {
    const paymentTerm = await this.prisma.paymentTerm.findUnique({
      where: { id },
    });

    if (!paymentTerm) {
      throw new NotFoundException('Payment term not found');
    }

    // Soft delete (set isActive to false)
    await this.prisma.paymentTerm.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
