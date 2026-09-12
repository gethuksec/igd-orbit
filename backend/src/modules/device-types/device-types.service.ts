import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import {
  CreateDeviceTypeDto,
  UpdateDeviceTypeDto,
  ListDeviceTypesDto,
} from './dto';
import { Prisma } from '@prisma/client';

/**
 * Device Types Service (IGDERP-169)
 * Strict master source for Smart Repair device types — no free "lainnya" on intake.
 */
@Injectable()
export class DeviceTypesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: ListDeviceTypesDto) {
    const { page = 1, limit = 20, search, status } = query;

    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum =
      typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.DeviceTypeWhereInput = {};

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.deviceType.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.deviceType.count({ where }),
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

  /** Active device types for intake dropdowns — GET /api/v1/device-types/active */
  async findActive() {
    return this.prisma.deviceType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(id: string) {
    const row = await this.prisma.deviceType.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Device type not found');
    }
    return row;
  }

  private codeOf(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  async create(dto: CreateDeviceTypeDto) {
    const code = dto.code?.trim() || this.codeOf(dto.name);
    const dup = await this.prisma.deviceType.findFirst({
      where: { OR: [{ code }, { name: dto.name }] },
    });
    if (dup) {
      throw new BadRequestException('Tipe perangkat sudah ada (kode/nama duplikat)');
    }
    return this.prisma.deviceType.create({
      data: {
        code,
        name: dto.name,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateDeviceTypeDto) {
    const row = await this.prisma.deviceType.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Device type not found');
    }
    if (dto.name && dto.name !== row.name) {
      const dup = await this.prisma.deviceType.findFirst({
        where: { name: dto.name, id: { not: id } },
      });
      if (dup) {
        throw new BadRequestException('Nama tipe perangkat sudah dipakai');
      }
    }
    return this.prisma.deviceType.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async delete(id: string): Promise<void> {
    const row = await this.prisma.deviceType.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Device type not found');
    }
    const used = await this.prisma.serviceOrder.count({
      where: { deviceType: row.code },
    });
    if (used > 0) {
      throw new BadRequestException(
        `Tipe perangkat dipakai ${used} service order — nonaktifkan saja`,
      );
    }
    await this.prisma.deviceType.delete({ where: { id } });
  }
}
