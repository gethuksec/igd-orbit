import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { CreateServiceTypeDto } from './dto/create-service-type.dto';
import { UpdateServiceTypeDto } from './dto/update-service-type.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class ServiceTypesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique service type code
   * Format: SVC-{random}
   * @returns Generated code string
   */
  async generateCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `SVC-${random}`;

      const existing = await this.prisma.serviceType.findUnique({
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

  async seedServiceTypes() {
    const serviceTypes = [
      {
        code: 'SCREEN_REPLACE_HP',
        name: 'Screen Replacement (HP)',
        description: 'Screen replacement for handphone devices',
        basePrice: new Decimal(300000),
        minPrice: new Decimal(150000),
        maxPrice: new Decimal(500000),
        slaHours: 4,
      },
      {
        code: 'BATTERY_REPLACE',
        name: 'Battery Replacement',
        description: 'Battery replacement service',
        basePrice: new Decimal(200000),
        minPrice: new Decimal(100000),
        maxPrice: new Decimal(300000),
        slaHours: 2,
      },
      {
        code: 'CHARGING_PORT',
        name: 'Charging Port Repair',
        description: 'Charging port repair service',
        basePrice: new Decimal(150000),
        minPrice: new Decimal(100000),
        maxPrice: new Decimal(200000),
        slaHours: 3,
      },
      {
        code: 'WATER_DAMAGE',
        name: 'Water Damage Repair',
        description: 'Water damage repair and cleaning',
        basePrice: new Decimal(500000),
        minPrice: new Decimal(200000),
        maxPrice: new Decimal(1000000),
        slaHours: 72, // 3 days
      },
      {
        code: 'SOFTWARE_ISSUE',
        name: 'Software Issue',
        description: 'Software troubleshooting and repair',
        basePrice: new Decimal(125000),
        minPrice: new Decimal(50000),
        maxPrice: new Decimal(200000),
        slaHours: 2,
      },
      {
        code: 'MOTHERBOARD_REPAIR',
        name: 'Motherboard Repair',
        description: 'Motherboard repair and component replacement',
        basePrice: new Decimal(1000000),
        minPrice: new Decimal(300000),
        maxPrice: new Decimal(2000000),
        slaHours: 120, // 5 days
      },
    ];

    const results = [];

    for (const serviceType of serviceTypes) {
      const existing = await this.prisma.serviceType.findUnique({
        where: { code: serviceType.code },
      });

      if (!existing) {
        await this.prisma.serviceType.create({
          data: serviceType,
        });
        results.push({ action: 'created', code: serviceType.code });
      } else {
        results.push({ action: 'exists', code: serviceType.code });
      }
    }

    return results;
  }

  async findAll({ includeInactive, status }: { includeInactive?: boolean, status?: 'all' | 'active' | 'inactive' } = {}) {
    const where: any = {};

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

    const serviceTypes = await this.prisma.serviceType.findMany({
      where,
      include: {
        _count: {
          select: {
            serviceOrders: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform Decimal values to numbers for JSON serialization
    return serviceTypes.map((st) => ({
      id: st.id,
      code: st.code,
      name: st.name,
      description: st.description,
      basePrice: st.basePrice.toNumber(),
      minPrice: st.minPrice ? st.minPrice.toNumber() : null,
      maxPrice: st.maxPrice ? st.maxPrice.toNumber() : null,
      slaHours: st.slaHours,
      isActive: st.isActive,
      serviceOrderCount: st._count.serviceOrders,
      createdAt: st.createdAt,
      updatedAt: st.updatedAt,
    }));
  }

  async findById(id: string) {
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            serviceOrders: true,
          },
        },
      },
    });

    if (!serviceType) {
      throw new NotFoundException('Service type not found');
    }

    // Transform Decimal values to numbers for JSON serialization
    return {
      id: serviceType.id,
      code: serviceType.code,
      name: serviceType.name,
      description: serviceType.description,
      basePrice: serviceType.basePrice.toNumber(),
      minPrice: serviceType.minPrice ? serviceType.minPrice.toNumber() : null,
      maxPrice: serviceType.maxPrice ? serviceType.maxPrice.toNumber() : null,
      slaHours: serviceType.slaHours,
      isActive: serviceType.isActive,
      serviceOrderCount: serviceType._count.serviceOrders,
      createdAt: serviceType.createdAt,
      updatedAt: serviceType.updatedAt,
    };
  }

  async create(createServiceTypeDto: CreateServiceTypeDto) {
    // Generate code if not provided
    let code = createServiceTypeDto.code;
    if (!code) {
      code = await this.generateCode();
    } else {
      // Check code uniqueness
      const existing = await this.prisma.serviceType.findUnique({
        where: { code },
      });

      if (existing) {
        throw new ConflictException('Service type code already exists');
      }
    }

    // Validate price range
    if (createServiceTypeDto.minPrice && createServiceTypeDto.maxPrice) {
      if (createServiceTypeDto.minPrice > createServiceTypeDto.maxPrice) {
        throw new BadRequestException('Min price cannot be greater than max price');
      }
    }

    if (createServiceTypeDto.minPrice && createServiceTypeDto.minPrice > createServiceTypeDto.basePrice) {
      throw new BadRequestException('Min price cannot be greater than base price');
    }

    if (createServiceTypeDto.maxPrice && createServiceTypeDto.maxPrice < createServiceTypeDto.basePrice) {
      throw new BadRequestException('Max price cannot be less than base price');
    }

    const serviceType = await this.prisma.serviceType.create({
      data: {
        code,
        name: createServiceTypeDto.name,
        description: createServiceTypeDto.description || null,
        basePrice: new Decimal(createServiceTypeDto.basePrice),
        minPrice: createServiceTypeDto.minPrice ? new Decimal(createServiceTypeDto.minPrice) : null,
        maxPrice: createServiceTypeDto.maxPrice ? new Decimal(createServiceTypeDto.maxPrice) : null,
        slaHours: createServiceTypeDto.slaHours,
        isActive: createServiceTypeDto.isActive !== undefined ? createServiceTypeDto.isActive : true,
      },
    });

    return {
      id: serviceType.id,
      code: serviceType.code,
      name: serviceType.name,
      description: serviceType.description,
      basePrice: serviceType.basePrice.toNumber(),
      minPrice: serviceType.minPrice ? serviceType.minPrice.toNumber() : null,
      maxPrice: serviceType.maxPrice ? serviceType.maxPrice.toNumber() : null,
      slaHours: serviceType.slaHours,
      isActive: serviceType.isActive,
      createdAt: serviceType.createdAt,
      updatedAt: serviceType.updatedAt,
    };
  }

  async update(id: string, updateServiceTypeDto: UpdateServiceTypeDto) {
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id },
    });

    if (!serviceType) {
      throw new NotFoundException('Service type not found');
    }

    // Check code uniqueness if updating code
    if (updateServiceTypeDto.code && updateServiceTypeDto.code !== serviceType.code) {
      const existing = await this.prisma.serviceType.findUnique({
        where: { code: updateServiceTypeDto.code },
      });

      if (existing) {
        throw new ConflictException('Service type code already exists');
      }
    }

    // Validate price range
    const basePrice = updateServiceTypeDto.basePrice !== undefined
      ? updateServiceTypeDto.basePrice
      : serviceType.basePrice.toNumber();
    const minPrice = updateServiceTypeDto.minPrice !== undefined
      ? updateServiceTypeDto.minPrice
      : (serviceType.minPrice ? serviceType.minPrice.toNumber() : null);
    const maxPrice = updateServiceTypeDto.maxPrice !== undefined
      ? updateServiceTypeDto.maxPrice
      : (serviceType.maxPrice ? serviceType.maxPrice.toNumber() : null);

    if (minPrice && maxPrice && minPrice > maxPrice) {
      throw new BadRequestException('Min price cannot be greater than max price');
    }

    if (minPrice && minPrice > basePrice) {
      throw new BadRequestException('Min price cannot be greater than base price');
    }

    if (maxPrice && maxPrice < basePrice) {
      throw new BadRequestException('Max price cannot be less than base price');
    }

    const updateData: any = {};

    if (updateServiceTypeDto.code !== undefined) {
      updateData.code = updateServiceTypeDto.code;
    }
    if (updateServiceTypeDto.name !== undefined) {
      updateData.name = updateServiceTypeDto.name;
    }
    if (updateServiceTypeDto.description !== undefined) {
      updateData.description = updateServiceTypeDto.description || null;
    }
    if (updateServiceTypeDto.basePrice !== undefined) {
      updateData.basePrice = new Decimal(updateServiceTypeDto.basePrice);
    }
    if (updateServiceTypeDto.minPrice !== undefined) {
      updateData.minPrice = updateServiceTypeDto.minPrice ? new Decimal(updateServiceTypeDto.minPrice) : null;
    }
    if (updateServiceTypeDto.maxPrice !== undefined) {
      updateData.maxPrice = updateServiceTypeDto.maxPrice ? new Decimal(updateServiceTypeDto.maxPrice) : null;
    }
    if (updateServiceTypeDto.slaHours !== undefined) {
      updateData.slaHours = updateServiceTypeDto.slaHours;
    }
    if (updateServiceTypeDto.isActive !== undefined) {
      updateData.isActive = updateServiceTypeDto.isActive;
    }

    const updated = await this.prisma.serviceType.update({
      where: { id },
      data: updateData,
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      description: updated.description,
      basePrice: updated.basePrice.toNumber(),
      minPrice: updated.minPrice ? updated.minPrice.toNumber() : null,
      maxPrice: updated.maxPrice ? updated.maxPrice.toNumber() : null,
      slaHours: updated.slaHours,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async delete(id: string) {
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            serviceOrders: true,
          },
        },
      },
    });

    if (!serviceType) {
      throw new NotFoundException('Service type not found');
    }

    // Check if has service orders
    if (serviceType._count.serviceOrders > 0) {
      throw new BadRequestException(
        `Cannot delete service type with ${serviceType._count.serviceOrders} service order(s). Please reassign or remove service orders first.`,
      );
    }

    // Soft delete (set isActive to false)
    return this.prisma.serviceType.update({
      where: { id },
      data: { isActive: false },
    });
  }
}



