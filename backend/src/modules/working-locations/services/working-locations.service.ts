import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreateWorkingLocationDto } from '../dto/create-working-location.dto';
import { UpdateWorkingLocationDto } from '../dto/update-working-location.dto';
import { randomBytes } from 'crypto';

/**
 * Working Locations Service (IGDERP-270)
 * Manual CRUD master for HQ-like work sites (lon/lat + clock-in radius).
 * Branches stay outlet-only by construction — HQ-like sites live here so
 * they can never leak into outlet dropdowns. No auto-creation.
 */
@Injectable()
export class WorkingLocationsService {
  constructor(private prisma: PrismaService) {}

  private include = {
    branch: { select: { id: true, code: true, name: true } },
    _count: { select: { contractWorkingLocations: true } },
  };

  async findAll() {
    const locations = await this.prisma.workingLocation.findMany({
      where: { isActive: true },
      include: this.include,
      orderBy: [{ code: 'asc' }],
    });
    return { data: locations, total: locations.length };
  }

  async findAllPaginated(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [locations, total] = await Promise.all([
      this.prisma.workingLocation.findMany({
        where,
        skip,
        take: limit,
        include: this.include,
        orderBy: [{ code: 'asc' }],
      }),
      this.prisma.workingLocation.count({ where }),
    ]);
    return {
      data: locations,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const location = await this.prisma.workingLocation.findUnique({
      where: { id },
      include: {
        ...this.include,
        contractWorkingLocations: {
          select: {
            contract: { select: { id: true, contractNumber: true, status: true } },
          },
          take: 50,
        },
      },
    });
    if (!location) {
      throw new NotFoundException('Working location not found');
    }
    return location;
  }

  private async assertBranchRef(branchId?: string | null) {
    if (!branchId) return;
    const branch = await this.prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch || !branch.isActive) {
      throw new BadRequestException('Branch not found or inactive');
    }
  }

  async create(dto: CreateWorkingLocationDto) {
    const code = dto.code ?? (await this.generateCode());
    const existing = await this.prisma.workingLocation.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('Working location code already exists');
    }
    await this.assertBranchRef(dto.branchId);
    return this.prisma.workingLocation.create({
      data: {
        code,
        name: dto.name,
        address: dto.address ?? null,
        branchId: dto.branchId ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        radiusM: dto.radiusM ?? 100,
        isActive: dto.isActive ?? true,
      },
      include: this.include,
    });
  }

  async update(id: string, dto: UpdateWorkingLocationDto) {
    await this.findById(id);
    if (dto.branchId) {
      await this.assertBranchRef(dto.branchId);
    }
    return this.prisma.workingLocation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.radiusM !== undefined ? { radiusM: dto.radiusM } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: this.include,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    await this.prisma.workingLocation.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async generateCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = `WL-${randomBytes(3).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.workingLocation.findUnique({ where: { code } });
      if (!existing) return code;
    }
    throw new ConflictException('Could not generate a unique working location code');
  }
}
