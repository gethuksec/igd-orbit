import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import {
  CreateServiceCheckpointDto,
  UpdateServiceCheckpointDto,
  ListServiceCheckpointsDto,
} from './dto';
import { Prisma } from '@prisma/client';

/**
 * Service Checkpoints Service
 * Handles Kelengkapan master data (dynamic checklist items for service forms)
 */
@Injectable()
export class ServiceCheckpointsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find all checkpoints with search, status filter and pagination
   */
  async findAll(query: ListServiceCheckpointsDto) {
    const { page = 1, limit = 20, search, status } = query;

    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum =
      typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.ServiceCheckpointWhereInput = {};

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      this.prisma.serviceCheckpoint.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.serviceCheckpoint.count({ where }),
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
   * Get active checkpoints sorted by sortOrder — used by service forms
   * GET /api/v1/service-checkpoints/active
   */
  async findActive() {
    return this.prisma.serviceCheckpoint.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Find checkpoint by ID
   */
  async findById(id: string) {
    const checkpoint = await this.prisma.serviceCheckpoint.findUnique({
      where: { id },
    });

    if (!checkpoint) {
      throw new NotFoundException('Service checkpoint not found');
    }

    return checkpoint;
  }

  /**
   * Create new checkpoint
   */
  async create(dto: CreateServiceCheckpointDto) {
    // Check duplicate name
    const existing = await this.prisma.serviceCheckpoint.findFirst({
      where: { name: dto.name, isActive: true },
    });

    if (existing) {
      throw new BadRequestException(`Checkpoint '${dto.name}' already exists`);
    }

    // Auto sortOrder: max + 1 if not provided
    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined) {
      const max = await this.prisma.serviceCheckpoint.aggregate({
        _max: { sortOrder: true },
      });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }

    return this.prisma.serviceCheckpoint.create({
      data: {
        name: dto.name,
        isActive: dto.isActive ?? true,
        sortOrder,
      },
    });
  }

  /**
   * Update checkpoint
   */
  async update(id: string, dto: UpdateServiceCheckpointDto) {
    const checkpoint = await this.prisma.serviceCheckpoint.findUnique({
      where: { id },
    });

    if (!checkpoint) {
      throw new NotFoundException('Service checkpoint not found');
    }

    // Check duplicate name
    if (dto.name && dto.name !== checkpoint.name) {
      const existing = await this.prisma.serviceCheckpoint.findFirst({
        where: {
          name: dto.name,
          isActive: true,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException(`Checkpoint '${dto.name}' already exists`);
      }
    }

    const updateData: Prisma.ServiceCheckpointUpdateInput = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;

    return this.prisma.serviceCheckpoint.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete checkpoint (hard delete — it's master data, orders keep JSON snapshot)
   */
  async delete(id: string): Promise<void> {
    const checkpoint = await this.prisma.serviceCheckpoint.findUnique({
      where: { id },
    });

    if (!checkpoint) {
      throw new NotFoundException('Service checkpoint not found');
    }

    await this.prisma.serviceCheckpoint.delete({ where: { id } });
  }
}
