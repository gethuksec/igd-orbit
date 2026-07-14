import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateExpeditionDto, UpdateExpeditionDto, ListExpeditionsDto } from './dto';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

/**
 * Expeditions Service
 * Handles expedition management operations
 */
@Injectable()
export class ExpeditionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique expedition code
   * Format: EXP-{random}
   * @returns Generated code string
   */
  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `EXP-${random}`;

      const existing = await this.prisma.expedition.findUnique({
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
   * Find all expeditions with search and pagination
   * @param query - Query parameters
   * @returns Paginated list of expeditions
   */
  async findAll(query: ListExpeditionsDto) {
    const { page = 1, limit = 20, search } = query;
    
    // Ensure page and limit are numbers (fallback if transform didn't work)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.ExpeditionWhereInput = {
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
      this.prisma.expedition.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { name: 'asc' },
      }),
      this.prisma.expedition.count({ where }),
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
   * Find expedition by ID
   * @param id - Expedition ID
   * @returns Expedition detail
   */
  async findById(id: string) {
    const expedition = await this.prisma.expedition.findUnique({
      where: { id },
    });

    if (!expedition) {
      throw new NotFoundException('Expedition not found');
    }

    return expedition;
  }

  /**
   * Create new expedition
   * @param createExpeditionDto - Expedition creation data
   * @returns Created expedition
   */
  async create(createExpeditionDto: CreateExpeditionDto) {
    // Generate code if not provided
    let code = createExpeditionDto.code;
    if (!code) {
      code = await this.generateCode();
    } else {
      // Check code uniqueness
      const existing = await this.prisma.expedition.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException('Expedition code already exists');
      }
    }

    // Check name uniqueness
    const existingName = await this.prisma.expedition.findFirst({
      where: {
        name: createExpeditionDto.name,
        isActive: true,
      },
    });

    if (existingName) {
      throw new ConflictException('Expedition name must be unique');
    }

    // Create expedition
    const expedition = await this.prisma.expedition.create({
      data: {
        code,
        name: createExpeditionDto.name,
        isActive: true,
      },
    });

    return expedition;
  }

  /**
   * Update expedition
   * @param id - Expedition ID
   * @param updateExpeditionDto - Expedition update data
   * @returns Updated expedition
   */
  async update(id: string, updateExpeditionDto: UpdateExpeditionDto) {
    const expedition = await this.prisma.expedition.findUnique({
      where: { id },
    });

    if (!expedition) {
      throw new NotFoundException('Expedition not found');
    }

    // Check name uniqueness if updating
    if (updateExpeditionDto.name && updateExpeditionDto.name !== expedition.name) {
      const existingName = await this.prisma.expedition.findFirst({
        where: {
          name: updateExpeditionDto.name,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingName) {
        throw new ConflictException('Expedition name must be unique');
      }
    }

    // Check code uniqueness if updating
    if (updateExpeditionDto.code && updateExpeditionDto.code !== expedition.code) {
      const existing = await this.prisma.expedition.findUnique({
        where: { code: updateExpeditionDto.code },
      });
      if (existing) {
        throw new ConflictException('Expedition code already exists');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateExpeditionDto.name !== undefined) {
      updateData.name = updateExpeditionDto.name;
    }
    if (updateExpeditionDto.code !== undefined) {
      updateData.code = updateExpeditionDto.code;
    }

    // Update expedition
    const updatedExpedition = await this.prisma.expedition.update({
      where: { id },
      data: updateData,
    });

    return updatedExpedition;
  }

  /**
   * Soft delete expedition
   * @param id - Expedition ID
   */
  async delete(id: string): Promise<void> {
    const expedition = await this.prisma.expedition.findUnique({
      where: { id },
    });

    if (!expedition) {
      throw new NotFoundException('Expedition not found');
    }

    // Soft delete (set isActive to false)
    await this.prisma.expedition.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
