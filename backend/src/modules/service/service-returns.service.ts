import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateServiceReturnDto } from './dto/create-service-return.dto';
import { UpdateServiceReturnDto } from './dto/update-service-return.dto';
import { ApproveServiceReturnDto, RejectServiceReturnDto } from './dto/approve-service-return.dto';
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
   * Generate return number: RET-SRV-YYYYMMDD-XXXXXX
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
   * Check if service order is within 30 days from delivered date
   */
  private isWithinReturnPeriod(deliveredAt: Date | null): boolean {
    if (!deliveredAt) return false;
    const now = new Date();
    const diffTime = now.getTime() - deliveredAt.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays <= 30;
  }

  /**
   * Check if service order is within warranty period
   */
  private isWithinWarranty(deliveredAt: Date | null, warrantyDays: number): boolean {
    if (!deliveredAt) return false;
    const now = new Date();
    const warrantyExpiry = new Date(deliveredAt);
    warrantyExpiry.setDate(warrantyExpiry.getDate() + warrantyDays);
    return now <= warrantyExpiry;
  }

  /**
   * Create service return/complaint
   */
  async create(dto: CreateServiceReturnDto, userId: string) {
    // Get service order
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id: dto.serviceOrderId },
      include: {
        branch: true,
        customer: true,
      },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    // Validate: Service must be delivered
    if (serviceOrder.status !== 'delivered') {
      throw new BadRequestException('Service order must be delivered before creating return');
    }

    // Check return period (30 days)
    const isWithinPeriod = this.isWithinReturnPeriod(serviceOrder.deliveredAt);
    if (!isWithinPeriod) {
      throw new BadRequestException('Service return must be within 30 days from delivery date');
    }

    // Check warranty period
    const isWithinWarranty = this.isWithinWarranty(
      serviceOrder.deliveredAt,
      serviceOrder.warrantyDays,
    );

    // Validate customer complaint if return type is complaint or combination
    if (
      (dto.returnType === 'complaint' || dto.returnType === 'combination') &&
      !dto.customerComplaint
    ) {
      throw new BadRequestException('Customer complaint is required for complaint type');
    }

    // Generate return number
    const returnNumber = this.generateReturnNumber();

    // Create return
    const serviceReturn = await this.prisma.serviceReturn.create({
      data: {
        returnNumber,
        serviceOrderId: dto.serviceOrderId,
        returnType: dto.returnType,
        returnReason: dto.returnReason,
        customerComplaint: dto.customerComplaint || null,
        isWithinWarranty,
        isWithinReturnPeriod: isWithinPeriod,
        status: 'pending',
        returnedAt: dto.returnedAt ? new Date(dto.returnedAt) : new Date(),
        createdBy: userId,
      },
      include: {
        serviceOrder: {
          include: {
            branch: true,
            customer: true,
          },
        },
      },
    });

    return serviceReturn;
  }

  /**
   * List all service returns with filters
   */
  async findAll(query: any) {
    const { page = 1, limit = 20, status, returnType, branchId, search } = query;
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (returnType) {
      where.returnType = returnType;
    }

    if (branchId) {
      where.serviceOrder = {
        branchId,
      };
    }

    if (search) {
      where.OR = [
        { returnNumber: { contains: search, mode: 'insensitive' } },
        { returnReason: { contains: search, mode: 'insensitive' } },
        {
          serviceOrder: {
            serviceNumber: { contains: search, mode: 'insensitive' },
          },
        },
        {
          serviceOrder: {
            customerName: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [returns, total] = await Promise.all([
      this.prisma.serviceReturn.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          serviceOrder: {
            include: {
              branch: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
              customer: {
                select: {
                  id: true,
                  name: true,
                  customerCode: true,
                },
              },
            },
          },
          newServiceOrder: {
            select: {
              id: true,
              serviceNumber: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.serviceReturn.count({ where }),
    ]);

    return {
      data: returns,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Get service return by ID
   */
  async findById(id: string) {
    const serviceReturn = await this.prisma.serviceReturn.findUnique({
      where: { id },
      include: {
        serviceOrder: {
          include: {
            branch: true,
            customer: true,
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
            branch: true,
            customer: true,
            assignedTechnician: {
              select: {
                id: true,
                fullName: true,
              },
            },
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

    // Only allow update if status is pending or investigating
    if (!['pending', 'investigating'].includes(serviceReturn.status)) {
      throw new BadRequestException('Cannot update return that is already approved/rejected/resolved');
    }

    const updateData: any = {};

    if (dto.returnReason !== undefined) {
      updateData.returnReason = dto.returnReason;
    }

    if (dto.customerComplaint !== undefined) {
      updateData.customerComplaint = dto.customerComplaint;
    }

    if (dto.resolution !== undefined) {
      updateData.resolution = dto.resolution;
    }

    if (dto.resolutionType !== undefined) {
      updateData.resolutionType = dto.resolutionType;
    }

    if (dto.refundAmount !== undefined) {
      updateData.refundAmount = new Decimal(dto.refundAmount);
    }

    return this.prisma.serviceReturn.update({
      where: { id },
      data: updateData,
      include: {
        serviceOrder: {
          include: {
            branch: true,
            customer: true,
          },
        },
      },
    });
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
      throw new BadRequestException('Return is already processed');
    }

    // Check approval authority based on service order total price
    // const totalPrice = serviceReturn.serviceOrder.totalPrice?.toNumber() || 0;
    // TODO: Check user role and approval limits
    // For now, allow any authenticated user to approve

    return this.prisma.serviceReturn.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        resolution: dto.resolution || null,
        resolutionType: dto.resolutionType || null,
      },
      include: {
        serviceOrder: {
          include: {
            branch: true,
            customer: true,
          },
        },
      },
    });
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
      throw new BadRequestException('Return is already processed');
    }

    return this.prisma.serviceReturn.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: dto.rejectionReason,
      },
      include: {
        serviceOrder: {
          include: {
            branch: true,
            customer: true,
          },
        },
      },
    });
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
            branch: true,
            customer: true,
          },
        },
      },
    });

    if (!serviceReturn) {
      throw new NotFoundException('Service return not found');
    }

    if (serviceReturn.status !== 'approved') {
      throw new BadRequestException('Return must be approved before creating re-service');
    }

    if (serviceReturn.newServiceOrderId) {
      throw new BadRequestException('Re-service order already created for this return');
    }

    const originalOrder = serviceReturn.serviceOrder;

    // Create new service order based on original
    const newServiceOrder = await this.serviceOrdersService.create(
      {
        customerId: originalOrder.customerId || undefined,
        customerName: originalOrder.customerName,
        customerPhone: originalOrder.customerPhone,
        customerEmail: originalOrder.customerEmail || undefined,
        customerAlternatePhone: originalOrder.customerAlternatePhone || undefined,
        deviceType: originalOrder.deviceType as any,
        deviceBrand: originalOrder.deviceBrand || undefined,
        deviceModel: originalOrder.deviceModel || undefined,
        deviceSerial: originalOrder.deviceSerial || undefined,
        deviceImei: originalOrder.deviceImei || undefined,
        devicePassword: originalOrder.devicePassword || undefined,
        deviceCondition: originalOrder.deviceCondition || undefined,
        accessoriesIncluded: originalOrder.accessoriesIncluded as any,
        complaint: `Re-service dari ${originalOrder.serviceNumber}. ${serviceReturn.returnReason}`,
        priority: 'urgent', // Auto set to urgent
        customerNotes: dto.notes || `Re-service untuk return ${serviceReturn.returnNumber}`,
      },
      userId,
      originalOrder.branchId,
    );

    // Assign technician if provided
    if (dto.assignedTechnicianId) {
      await this.serviceOrdersService.assignTechnician(
        newServiceOrder.id,
        { technicianId: dto.assignedTechnicianId },
        userId,
      );
    }

    // Set promised date if provided
    if (dto.promisedDate) {
      await this.prisma.serviceOrder.update({
        where: { id: newServiceOrder.id },
        data: { promisedDate: new Date(dto.promisedDate) },
      });
    }

    // Update return with new service order ID
    const updatedReturn = await this.prisma.serviceReturn.update({
      where: { id },
      data: {
        newServiceOrderId: newServiceOrder.id,
        resolutionType: 're-service',
      },
      include: {
        serviceOrder: {
          include: {
            branch: true,
            customer: true,
          },
        },
        newServiceOrder: {
          include: {
            branch: true,
            customer: true,
          },
        },
      },
    });

    return updatedReturn;
  }

  /**
   * Resolve service return (mark as resolved)
   */
  async resolve(id: string, _userId: string) {
    const serviceReturn = await this.prisma.serviceReturn.findUnique({
      where: { id },
    });

    if (!serviceReturn) {
      throw new NotFoundException('Service return not found');
    }

    if (serviceReturn.status !== 'approved') {
      throw new BadRequestException('Return must be approved before resolving');
    }

    return this.prisma.serviceReturn.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
      },
      include: {
        serviceOrder: {
          include: {
            branch: true,
            customer: true,
          },
        },
        newServiceOrder: {
          include: {
            branch: true,
            customer: true,
          },
        },
      },
    });
  }
}

