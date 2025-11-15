import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ServiceTypesService {
  constructor(private prisma: PrismaService) {}

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

  async findAll() {
    const serviceTypes = await this.prisma.serviceType.findMany({
      where: { isActive: true },
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
      createdAt: st.createdAt,
      updatedAt: st.updatedAt,
    }));
  }

  async findById(id: string) {
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id },
    });

    if (!serviceType) {
      return null;
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
      createdAt: serviceType.createdAt,
      updatedAt: serviceType.updatedAt,
    };
  }
}



