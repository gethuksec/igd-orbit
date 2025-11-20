import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateServiceReturnDto } from './dto/create-service-return.dto';
import { UpdateServiceReturnDto } from './dto/update-service-return.dto';
import { ApproveServiceReturnDto } from './dto/approve-service-return.dto';
import { RejectServiceReturnDto } from './dto/reject-service-return.dto';
import { CreateReServiceDto } from './dto/create-re-service.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { ServiceOrdersService } from './service-orders.service';

@Injectable()
export class ServiceReturnsService {
  constructor(
    private prisma: PrismaService,
    private serviceOrdersService: ServiceOrdersService,
  ) {}

  /**
   * Generate return number
   * Format: RET-SRV-YYYYMMDD-XXXXXX
   */
  private generateReturnNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `RET-SRV-${dateStr}-${random}`;
  }

  /**
   * Check if return is within 30-day period
   */
  private isWithinReturnPeriod(deliveredAt: Date | null): boolean {
    if (!deliveredAt) return false;
    const now = new Date();
    const diffTime = now.getTime() - deliveredAt.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30;
  }

  /**
   * Check if return is within warranty period
   */
  private isWithinWarranty(
    deliveredAt: Date | null,
    warrantyDays: number,
  ): boolean {
    if (!deliveredAt || !warrantyDays) return false;
    const now = new Date();
    const warrantyExpiry = new Date(deliveredAt);
    warrantyExpiry.setDate(warrantyExpiry.getDate() + warrantyDays);
    return now <= warrantyExpiry;
  }

  /**
   * Create new service return
   */
  async create(dto: CreateServiceReturnDto, userId: string) {
    // Validate service order exists and is delivered
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id: dto.serviceOrderId },
      include: {
        customer: true,
      },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    if (serviceOrder.status !== 'delivered') {
      throw new BadRequestException(
        'Service order must be delivered before creating return',
      );
    }

    // Check if service order already has an active return
    // Active return = pending, investigating, approved, or resolved
    // Only rejected returns allow creating a new return
    const existingReturn = await this.prisma.serviceReturn.findFirst({
      where: {
        serviceOrderId: dto.serviceOrderId,
        status: {
          notIn: ['rejected'], // Only rejected status allows new return
        },
      },
    });

    if (existingReturn) {
      throw new BadRequestException(
        `Service order already has an active return (${existingReturn.returnNumber}). Please resolve or reject the existing return before creating a new one.`,
      );
    }

    // Check 30-day return period
    const isWithinReturnPeriod = this.isWithinReturnPeriod(
      serviceOrder.deliveredAt,
    );
    if (!isWithinReturnPeriod) {
      throw new BadRequestException(
        'Return must be within 30 days from delivery date',
      );
    }

    // Check warranty period
    const isWithinWarranty = this.isWithinWarranty(
      serviceOrder.deliveredAt,
      serviceOrder.warrantyDays,
    );

    // Validate customer complaint for complaint/combination types
    if (
      (dto.returnType === 'complaint' || dto.returnType === 'combination') &&
      !dto.customerComplaint
    ) {
      throw new BadRequestException(
        'Customer complaint is required for complaint/combination return types',
      );
    }

    // Generate return number
    let returnNumber = this.generateReturnNumber();
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const existing = await this.prisma.serviceReturn.findUnique({
        where: { returnNumber },
      });
      if (!existing) {
        isUnique = true;
      } else {
        returnNumber = this.generateReturnNumber();
        attempts++;
      }
    }

    if (!isUnique) {
      throw new BadRequestException(
        'Failed to generate unique return number',
      );
    }

    // Create return
    const serviceReturn = await this.prisma.serviceReturn.create({
      data: {
        returnNumber,
        serviceOrderId: dto.serviceOrderId,
        returnType: dto.returnType,
        returnReason: dto.returnReason,
        customerComplaint: dto.customerComplaint,
        isWithinWarranty: isWithinWarranty,
        isWithinReturnPeriod: true,
        status: 'pending',
        returnedAt: new Date(),
        createdBy: userId,
      },
      include: {
        serviceOrder: {
          include: {
            customer: true,
            branch: true,
          },
        },
      },
    });

    return serviceReturn;
  }

  /**
   * Find all service returns with filters
   */
  async findAll(query?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    returnType?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    try {
      const {
        page: pageParam = 1,
        limit: limitParam = 20,
        search,
        status,
        returnType,
        branchId,
        startDate,
        endDate,
      } = query || {};

      // Ensure page and limit are numbers
      const page = typeof pageParam === 'string' ? parseInt(pageParam, 10) : pageParam || 1;
      const limit = typeof limitParam === 'string' ? parseInt(limitParam, 10) : limitParam || 20;

      const skip = (page - 1) * limit;
      const where: any = {};

      // Build search conditions
      if (search) {
        const searchConditions: any[] = [
          { returnNumber: { contains: search, mode: 'insensitive' } },
        ];

        // Add service order search conditions with branchId if provided
        if (branchId) {
          searchConditions.push({
            serviceOrder: {
              branchId,
              serviceNumber: { contains: search, mode: 'insensitive' },
            },
          });
          searchConditions.push({
            serviceOrder: {
              branchId,
              customerName: { contains: search, mode: 'insensitive' },
            },
          });
        } else {
          searchConditions.push({
            serviceOrder: {
              serviceNumber: { contains: search, mode: 'insensitive' },
            },
          });
          searchConditions.push({
            serviceOrder: {
              customerName: { contains: search, mode: 'insensitive' },
            },
          });
        }

        where.OR = searchConditions;
      } else if (branchId) {
        // No search, just branchId filter
        where.serviceOrder = {
          branchId,
        };
      }

      // Add other filters
      if (status) {
        where.status = status;
      }

      if (returnType) {
        where.returnType = returnType;
      }

      if (startDate || endDate) {
        where.returnedAt = {};
        if (startDate) {
          where.returnedAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.returnedAt.lte = new Date(endDate);
        }
      }

      const [data, total] = await Promise.all([
        this.prisma.serviceReturn.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            serviceOrder: {
              include: {
                customer: true,
                branch: true,
              },
            },
            newServiceOrder: {
              include: {
                customer: true,
              },
            },
          },
        }),
        this.prisma.serviceReturn.count({ where }),
      ]);

      return {
        data,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      console.error('Error in findAll service returns:', error);
      throw error;
    }
  }

  /**
   * Find service return by ID
   */
  async findById(id: string) {
    const serviceReturn = await this.prisma.serviceReturn.findUnique({
      where: { id },
      include: {
        serviceOrder: {
          include: {
            customer: true,
            branch: true,
            serviceType: true,
            assignedTechnician: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        },
        newServiceOrder: {
          include: {
            customer: true,
            branch: true,
            serviceType: true,
          },
        },
      },
    });

    if (!serviceReturn) {
      throw new NotFoundException('Service return not found');
    }

    return serviceReturn;
  }

  /**
   * Update service return
   */
  async update(id: string, dto: UpdateServiceReturnDto, _userId: string) {
    const serviceReturn = await this.prisma.serviceReturn.findUnique({
      where: { id },
    });

    if (!serviceReturn) {
      throw new NotFoundException('Service return not found');
    }

    if (serviceReturn.status !== 'pending' && serviceReturn.status !== 'investigating') {
      throw new BadRequestException(
        'Can only update pending or investigating returns',
      );
    }

    // Validate customer complaint for complaint/combination types
    if (
      (dto.returnType === 'complaint' || dto.returnType === 'combination') &&
      !dto.customerComplaint
    ) {
      throw new BadRequestException(
        'Customer complaint is required for complaint/combination return types',
      );
    }

    const updated = await this.prisma.serviceReturn.update({
      where: { id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
      include: {
        serviceOrder: {
          include: {
            customer: true,
            branch: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Approve service return
   */
  async approve(id: string, dto: ApproveServiceReturnDto, userId: string) {
    const serviceReturn = await this.prisma.serviceReturn.findUnique({
      where: { id },
      include: {
        serviceOrder: true,
      },
    });

    if (!serviceReturn) {
      throw new NotFoundException('Service return not found');
    }

    if (serviceReturn.status !== 'pending' && serviceReturn.status !== 'investigating') {
      throw new BadRequestException(
        'Can only approve pending or investigating returns',
      );
    }

    const updated = await this.prisma.serviceReturn.update({
      where: { id },
      data: {
        status: 'approved',
        resolution: dto.resolution,
        resolutionType: dto.resolutionType,
        refundAmount: dto.refundAmount
          ? new Decimal(dto.refundAmount)
          : null,
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        serviceOrder: {
          include: {
            customer: true,
            branch: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Reject service return
   */
  async reject(id: string, dto: RejectServiceReturnDto, userId: string) {
    const serviceReturn = await this.prisma.serviceReturn.findUnique({
      where: { id },
    });

    if (!serviceReturn) {
      throw new NotFoundException('Service return not found');
    }

    if (serviceReturn.status !== 'pending' && serviceReturn.status !== 'investigating') {
      throw new BadRequestException(
        'Can only reject pending or investigating returns',
      );
    }

    const updated = await this.prisma.serviceReturn.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectionReason: dto.rejectionReason,
        rejectedBy: userId,
        rejectedAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        serviceOrder: {
          include: {
            customer: true,
            branch: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Create re-service order from approved return
   */
  async createReService(id: string, dto: CreateReServiceDto, userId: string) {
    const serviceReturn = await this.prisma.serviceReturn.findUnique({
      where: { id },
      include: {
        serviceOrder: {
          include: {
            customer: true,
            branch: true,
          },
        },
      },
    });

    if (!serviceReturn) {
      throw new NotFoundException('Service return not found');
    }

    if (serviceReturn.status !== 'approved') {
      throw new BadRequestException(
        'Can only create re-service from approved returns',
      );
    }

    if (serviceReturn.newServiceOrderId) {
      throw new BadRequestException('Re-service order already created');
    }

    // Create new service order
    const originalOrder = serviceReturn.serviceOrder;
    const accessories = originalOrder.accessoriesIncluded as any;
    const newServiceOrder = await this.serviceOrdersService.create(
      {
        customerId: originalOrder.customerId || undefined,
        serviceTypeId: dto.serviceTypeId || originalOrder.serviceTypeId || undefined,
        customerName: originalOrder.customerName,
        customerPhone: originalOrder.customerPhone,
        customerEmail: originalOrder.customerEmail || undefined,
        customerAlternatePhone: originalOrder.customerAlternatePhone || undefined,
        deviceType: originalOrder.deviceType as 'handphone' | 'laptop' | 'tablet' | 'other',
        deviceBrand: originalOrder.deviceBrand || undefined,
        deviceModel: originalOrder.deviceModel || undefined,
        deviceSerial: originalOrder.deviceSerial || undefined,
        deviceImei: originalOrder.deviceImei || undefined,
        devicePassword: originalOrder.devicePassword || undefined,
        deviceCondition: originalOrder.deviceCondition || undefined,
        accessoriesIncluded: Array.isArray(accessories) ? accessories : undefined,
        complaint: `Re-service dari ${originalOrder.serviceNumber}. ${dto.notes || serviceReturn.returnReason}`,
        priority: 'urgent',
      },
      userId,
      originalOrder.branchId,
    );

    // Link return to new service order
    const updated = await this.prisma.serviceReturn.update({
      where: { id },
      data: {
        newServiceOrderId: newServiceOrder.id,
        updatedAt: new Date(),
      },
      include: {
        serviceOrder: {
          include: {
            customer: true,
            branch: true,
          },
        },
        newServiceOrder: {
          include: {
            customer: true,
            branch: true,
            serviceType: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Resolve service return
   */
  async resolve(id: string, _userId: string) {
    const serviceReturn = await this.prisma.serviceReturn.findUnique({
      where: { id },
    });

    if (!serviceReturn) {
      throw new NotFoundException('Service return not found');
    }

    if (serviceReturn.status === 'resolved') {
      throw new BadRequestException('Return is already resolved');
    }

    const updated = await this.prisma.serviceReturn.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        serviceOrder: {
          include: {
            customer: true,
            branch: true,
          },
        },
        newServiceOrder: {
          include: {
            customer: true,
            branch: true,
          },
        },
      },
    });

    return updated;
  }
}

