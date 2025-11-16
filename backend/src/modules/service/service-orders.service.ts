import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AddPartsDto } from './dto/add-parts.dto';
import { QcCheckDto } from './dto/qc-check.dto';
import { CustomerFeedbackDto } from './dto/customer-feedback.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { UploadPhotosDto } from './dto/upload-photos.dto';
import { encryptPassword, decryptPassword } from './utils/password-encryption.util';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ServiceOrdersService {
  constructor(private prisma: PrismaService) {}

  private generateServiceNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `SRV-${dateStr}-${random}`;
  }

  private generateInternalNumber(): string {
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `INT-${random}`;
  }


  async create(dto: CreateServiceOrderDto, userId: string, branchId: string) {
    const {
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAlternatePhone,
      deviceType,
      deviceBrand,
      deviceModel,
      deviceSerial,
      deviceImei,
      devicePassword,
      deviceCondition,
      accessoriesIncluded,
      complaint,
      initialDiagnosis,
      serviceTypeId,
      estimatedCost,
      priority = 'normal',
      promisedDate,
      customerNotes,
    } = dto;

    // Validate or create customer
    let finalCustomerId = customerId;
    if (!customerId) {
      // For walk-in customers, we'll just use the snapshot data
      // Optionally create a customer record
    } else {
      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
    }

    // Get service type for SLA calculation
    let slaDueDate: Date | null = null;
    let serviceType = null;
    if (serviceTypeId) {
      serviceType = await this.prisma.serviceType.findUnique({
        where: { id: serviceTypeId },
      });
      if (!serviceType) {
        throw new NotFoundException('Service type not found');
      }

      // Calculate SLA
      const baseSlaHours = serviceType.slaHours;
      const slaHours = priority === 'urgent' ? baseSlaHours * 0.5 : baseSlaHours;
      const receivedDate = new Date();
      slaDueDate = new Date(receivedDate.getTime() + slaHours * 60 * 60 * 1000);
    }

    // Encrypt device password if provided
    const encryptedPassword = devicePassword ? encryptPassword(devicePassword) : null;

    return await this.prisma.$transaction(async (tx) => {
      const serviceOrder = await tx.serviceOrder.create({
        data: {
          serviceNumber: this.generateServiceNumber(),
          internalNumber: this.generateInternalNumber(),
          branchId,
          customerId: finalCustomerId,
          serviceTypeId,
          customerName,
          customerPhone,
          customerEmail,
          customerAlternatePhone,
          deviceType,
          deviceBrand,
          deviceModel,
          deviceSerial,
          deviceImei,
          devicePassword: encryptedPassword,
          deviceCondition,
          accessoriesIncluded: accessoriesIncluded ? JSON.parse(JSON.stringify(accessoriesIncluded)) : null,
          complaint,
          initialDiagnosis,
          estimatedCost: estimatedCost ? new Decimal(estimatedCost) : null,
          priority,
          promisedDate: promisedDate ? new Date(promisedDate) : null,
          slaDueDate,
          receivedDate: new Date(),
          status: 'pending',
          createdBy: userId,
          customerNotes,
        },
        include: {
          branch: true,
          customer: true,
          serviceType: true,
        },
      });

      // Create initial status history
      await tx.serviceStatusHistory.create({
        data: {
          serviceOrderId: serviceOrder.id,
          status: 'pending',
          notes: 'Service order created',
          changedBy: userId,
        },
      });

      return serviceOrder;
    });
  }

  async findAll(branchId?: string, status?: string, technicianId?: string, search?: string) {
    const where: any = {};

    if (branchId) {
      where.branchId = branchId;
    }

    if (status) {
      where.status = status;
    }

    if (technicianId) {
      where.assignedTechnicianId = technicianId;
    }

    if (search) {
      const q = search.trim();
      if (q.length > 0) {
        where.OR = [
          { serviceNumber: { contains: q, mode: 'insensitive' } },
          { internalNumber: { contains: q, mode: 'insensitive' } },
          { customerName: { contains: q, mode: 'insensitive' } },
          { customerPhone: { contains: q, mode: 'insensitive' } },
          { deviceBrand: { contains: q, mode: 'insensitive' } },
          { deviceModel: { contains: q, mode: 'insensitive' } },
        ];
      }
    }

    return this.prisma.serviceOrder.findMany({
      where,
      include: {
        branch: true,
        customer: true,
        serviceType: true,
        assignedTechnician: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            partsUsed: true,
            photos: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, includePassword = false) {
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id },
      include: {
        branch: true,
        customer: true,
        serviceType: true,
        assignedTechnician: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        partsUsed: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
          },
        },
        photos: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    // Decrypt password only if authorized
    if (includePassword && serviceOrder.devicePassword) {
      try {
        serviceOrder.devicePassword = decryptPassword(serviceOrder.devicePassword);
      } catch (error) {
        // If decryption fails, return null
        serviceOrder.devicePassword = null;
      }
    } else if (!includePassword) {
      // Don't expose password
      serviceOrder.devicePassword = null;
    }

    return serviceOrder;
  }

  async update(id: string, dto: Partial<CreateServiceOrderDto>, _userId: string) {
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    // Only allow updates if status is pending or diagnosed
    if (!['pending', 'diagnosed'].includes(serviceOrder.status)) {
      throw new BadRequestException(
        `Cannot update service order with status: ${serviceOrder.status}`,
      );
    }

    const updateData: any = {};

    if (dto.devicePassword) {
      updateData.devicePassword = encryptPassword(dto.devicePassword);
    }

    if (dto.estimatedCost !== undefined) {
      updateData.estimatedCost = new Decimal(dto.estimatedCost);
    }

    if (dto.accessoriesIncluded) {
      updateData.accessoriesIncluded = JSON.parse(JSON.stringify(dto.accessoriesIncluded));
    }

    // Update other fields
    Object.keys(dto).forEach((key) => {
      if (
        key !== 'devicePassword' &&
        key !== 'estimatedCost' &&
        key !== 'accessoriesIncluded' &&
        dto[key as keyof CreateServiceOrderDto] !== undefined
      ) {
        updateData[key] = dto[key as keyof CreateServiceOrderDto];
      }
    });

    return this.prisma.serviceOrder.update({
      where: { id },
      data: updateData,
      include: {
        branch: true,
        customer: true,
        serviceType: true,
        assignedTechnician: true,
      },
    });
  }

  async assignTechnician(serviceOrderId: string, dto: AssignTechnicianDto, userId: string) {
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    // Validate technician exists
    const technician = await this.prisma.user.findUnique({
      where: { id: dto.technicianId },
    });

    if (!technician) {
      throw new NotFoundException('Technician not found');
    }

    // Extra safety: ensure selected user has technician role (TC)
    const technicianRole = await this.prisma.userRole.findFirst({
      where: {
        userId: dto.technicianId,
        role: { code: 'TC' },
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      include: { role: true },
    });

    if (!technicianRole) {
      throw new BadRequestException('Selected user is not a technician');
    }

    // Check technician workload (optional - can be enhanced)
    // const activeServices = await this.prisma.serviceOrder.count({
    //   where: {
    //     assignedTechnicianId: dto.technicianId,
    //     status: {
    //       in: ['diagnosed', 'approved', 'in-progress', 'qc'],
    //     },
    //   },
    // });

    return await this.prisma.$transaction(async (tx) => {
      const previousStatus = serviceOrder.status;
      const newStatus = serviceOrder.status === 'pending' ? 'diagnosed' : serviceOrder.status;

      const updated = await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          assignedTechnicianId: dto.technicianId,
          assignedAt: new Date(),
          status: newStatus,
          diagnosedAt: newStatus === 'diagnosed' ? new Date() : serviceOrder.diagnosedAt,
        },
        include: {
          assignedTechnician: true,
        },
      });

      // Create status history
      await tx.serviceStatusHistory.create({
        data: {
          serviceOrderId,
          status: newStatus,
          previousStatus,
          notes: dto.notes || `Assigned to technician`,
          changedBy: userId,
        },
      });

      return updated;
    });
  }

  async updateStatus(serviceOrderId: string, dto: UpdateStatusDto, userId: string) {
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      pending: ['diagnosed', 'cancelled'],
      diagnosed: ['quoted', 'cancelled'],
      quoted: ['approved', 'cancelled'],
      approved: ['in-progress', 'cancelled'],
      'in-progress': ['qc', 'cancelled'],
      qc: ['completed', 'in-progress'], // Can return to in-progress if QC fails
      completed: ['delivered'],
      delivered: [],
      cancelled: [],
    };

    const allowedStatuses = validTransitions[serviceOrder.status] || [];
    if (!allowedStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${serviceOrder.status} to ${dto.status}`,
      );
    }

    // Check required fields for specific statuses
    if (dto.status === 'quoted' && dto.quotedPrice === undefined && !serviceOrder.quotedPrice) {
      throw new BadRequestException('Quoted price is required for quoted status');
    }

    if (
      dto.status === 'approved' &&
      dto.customerApprovedPrice === undefined &&
      !serviceOrder.customerApprovedPrice
    ) {
      throw new BadRequestException('Customer approved price is required for approved status');
    }

    if (dto.status === 'completed' && serviceOrder.qualityStatus !== 'pass') {
      throw new BadRequestException('QC must pass before completing service');
    }

    return await this.prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: dto.status,
      };

      // Monetary fields coming from DTO (if provided)
      if (dto.quotedPrice !== undefined) {
        updateData.quotedPrice = new Decimal(dto.quotedPrice);
      }

      if (dto.customerApprovedPrice !== undefined) {
        updateData.customerApprovedPrice = new Decimal(dto.customerApprovedPrice);
      }

      // Update relevant timestamps
      if (dto.status === 'quoted') {
        updateData.quotedAt = new Date();
      } else if (dto.status === 'approved') {
        updateData.approvedAt = new Date();
      } else if (dto.status === 'in-progress') {
        updateData.startedAt = new Date();
      } else if (dto.status === 'completed') {
        updateData.completedAt = new Date();
      } else if (dto.status === 'delivered') {
        updateData.deliveredAt = new Date();
      } else if (dto.status === 'cancelled') {
        updateData.cancelledAt = new Date();
      }

      const updated = await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: updateData,
        include: {
          branch: true,
          customer: true,
          serviceType: true,
          assignedTechnician: true,
        },
      });

      // Create status history
      await tx.serviceStatusHistory.create({
        data: {
          serviceOrderId,
          status: dto.status,
          previousStatus: serviceOrder.status,
          notes: dto.notes,
          changedBy: userId,
        },
      });

      // Upload photos if provided
      if (dto.photos && dto.photos.length > 0) {
        await Promise.all(
          dto.photos.map((photoUrl) =>
            tx.servicePhoto.create({
              data: {
                serviceOrderId,
                photoUrl,
                photoType: 'repair', // Default type for status update photos
                uploadedBy: userId,
              },
            }),
          ),
        );
      }

      return updated;
    });
  }

  async addParts(serviceOrderId: string, dto: AddPartsDto, userId: string) {
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: {
        branch: true,
      },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    if (serviceOrder.status === 'delivered' || serviceOrder.status === 'cancelled') {
      throw new BadRequestException(
        `Cannot add parts to service order with status: ${serviceOrder.status}`,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      let totalPartsCost = Number(serviceOrder.partsCost);
      let totalPartsPrice = 0;

      // Process each part
      for (const part of dto.parts) {
        // Validate product exists and has stock
        const product = await tx.product.findUnique({
          where: { id: part.productId },
        });

        if (!product) {
          throw new NotFoundException(`Product ${part.productId} not found`);
        }

        // Check stock availability
        const stock = await tx.productStock.findUnique({
          where: {
            productId_branchId: {
              productId: part.productId,
              branchId: serviceOrder.branchId,
            },
          },
        });

        if (!stock) {
          throw new BadRequestException(
            `Product ${product.name} has no stock at branch`,
          );
        }

        const available = Number(stock.quantityAvailable);
        if (available < part.quantity) {
          throw new BadRequestException(
            `Insufficient stock for ${product.name}. Available: ${available}, Required: ${part.quantity}`,
          );
        }

        const quantity = new Decimal(part.quantity);
        const unitCost = new Decimal(part.unitCost);
        const unitPrice = new Decimal(part.unitPrice);
        const totalCost = quantity.mul(unitCost);
        const totalPrice = quantity.mul(unitPrice);

        // Create service parts used record
        await tx.servicePartsUsed.create({
          data: {
            serviceOrderId,
            productId: part.productId,
            quantity,
            unitCost,
            unitPrice,
            totalCost,
            totalPrice,
            batchNumber: part.batchNumber,
            serialNumber: part.serialNumber,
            notes: part.notes,
          },
        });

        // Deduct from inventory
        const quantityBefore = Number(stock.quantityAvailable);
        const quantityAfter = quantityBefore - part.quantity;

        await tx.productStock.update({
          where: {
            productId_branchId: {
              productId: part.productId,
              branchId: serviceOrder.branchId,
            },
          },
          data: {
            quantityAvailable: new Decimal(quantityAfter),
          },
        });

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            productId: part.productId,
            branchId: serviceOrder.branchId,
            movementType: 'OUT',
            referenceType: 'SERVICE',
            referenceId: serviceOrderId,
            quantityChange: new Decimal(-part.quantity),
            quantityBefore: new Decimal(quantityBefore),
            quantityAfter: new Decimal(quantityAfter),
            batchNumber: part.batchNumber,
            serialNumber: part.serialNumber,
            notes: `Parts used for service ${serviceOrder.serviceNumber}`,
            createdBy: userId,
          },
        });

        totalPartsCost += Number(totalCost);
        totalPartsPrice += Number(totalPrice);
      }

      // Update service order with total parts cost
      return tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          partsCost: new Decimal(totalPartsCost),
        },
        include: {
          partsUsed: {
            include: {
              product: true,
            },
          },
        },
      });
    });
  }

  async uploadPhotos(serviceOrderId: string, dto: UploadPhotosDto, userId: string) {
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    return await this.prisma.$transaction(async (tx) => {
      const photos = await Promise.all(
        dto.photoUrls.map((photoUrl) =>
          tx.servicePhoto.create({
            data: {
              serviceOrderId,
              photoUrl,
              photoType: dto.photoType,
              description: dto.description,
              uploadedBy: userId,
            },
          }),
        ),
      );

      return {
        serviceOrderId,
        photos,
      };
    });
  }

  async completeService(serviceOrderId: string, _userId: string) {
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: {
        partsUsed: true,
      },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    if (serviceOrder.status !== 'qc') {
      throw new BadRequestException(`Cannot complete service with status: ${serviceOrder.status}`);
    }

    if (serviceOrder.qualityStatus !== 'pass') {
      throw new BadRequestException('QC must pass before completing service');
    }

    // Calculate final price
    const laborCost = Number(serviceOrder.laborCost || 0);
    const partsCost = Number(serviceOrder.partsCost || 0);
    const otherCost = Number(serviceOrder.otherCost || 0);
    const subtotal = laborCost + partsCost + otherCost;
    const taxAmount = subtotal * 0.11;
    const totalPrice = subtotal + taxAmount;

    // Calculate warranty expiry date
    const warrantyExpiryDate = new Date();
    warrantyExpiryDate.setDate(warrantyExpiryDate.getDate() + serviceOrder.warrantyDays);

    return this.prisma.serviceOrder.update({
      where: { id: serviceOrderId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        finalPrice: new Decimal(subtotal),
        taxAmount: new Decimal(taxAmount),
        totalPrice: new Decimal(totalPrice),
        warrantyExpiryDate,
      },
      include: {
        branch: true,
        customer: true,
        serviceType: true,
        assignedTechnician: true,
        partsUsed: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  async trackService(serviceNumber: string) {
    try {
      const serviceOrder = await this.prisma.serviceOrder.findUnique({
        where: { serviceNumber },
        include: {
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            select: {
              status: true,
              createdAt: true,
              notes: true,
            },
          },
        },
      });

      if (!serviceOrder) {
        throw new NotFoundException(`Service order with number ${serviceNumber} not found`);
      }

    // Return sanitized data for public tracking
    return {
      serviceNumber: serviceOrder.serviceNumber,
      deviceType: serviceOrder.deviceType,
      deviceBrand: serviceOrder.deviceBrand,
      deviceModel: serviceOrder.deviceModel,
      status: serviceOrder.status,
      statusHistory: serviceOrder.statusHistory,
      receivedDate: serviceOrder.receivedDate,
      promisedDate: serviceOrder.promisedDate,
      estimatedCompletion: serviceOrder.promisedDate,
      // DO NOT expose: prices, technician names, internal notes, customer details
    };
    } catch (error) {
      console.error('Error tracking service:', serviceNumber, error);
      throw error;
    }
  }

  async qcCheck(serviceOrderId: string, dto: QcCheckDto, userId: string) {
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    if (serviceOrder.status !== 'qc') {
      throw new BadRequestException(`Cannot perform QC check on service with status: ${serviceOrder.status}`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const updateData: any = {
        qualityStatus: dto.status,
      };

      // If QC fails, return to in-progress
      if (dto.status === 'fail') {
        updateData.status = 'in-progress';
      }

      const updated = await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: updateData,
        include: {
          assignedTechnician: true,
        },
      });

      // Create status history
      await tx.serviceStatusHistory.create({
        data: {
          serviceOrderId,
          status: updateData.status || serviceOrder.status,
          previousStatus: serviceOrder.status,
          notes: `QC ${dto.status.toUpperCase()}: ${dto.notes || ''}`,
          changedBy: userId,
        },
      });

      // Upload photos if provided
      if (dto.photos && dto.photos.length > 0) {
        await Promise.all(
          dto.photos.map((photoUrl) =>
            tx.servicePhoto.create({
              data: {
                serviceOrderId,
                photoUrl,
                photoType: 'completed',
                description: 'QC photos',
                uploadedBy: userId,
              },
            }),
          ),
        );
      }

      return updated;
    });
  }

  async deliverService(serviceOrderId: string, _userId: string) {
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    if (serviceOrder.status !== 'completed') {
      throw new BadRequestException(`Cannot deliver service with status: ${serviceOrder.status}`);
    }

    if (serviceOrder.qualityStatus !== 'pass') {
      throw new BadRequestException('QC must pass before delivery');
    }

    // Check payment status (can be enhanced with actual payment processing)
    if (serviceOrder.paymentStatus !== 'paid') {
      // In production, this would trigger payment collection
      // For now, we'll allow delivery but flag it
    }

    return this.prisma.serviceOrder.update({
      where: { id: serviceOrderId },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        paymentStatus: 'paid', // Assuming payment collected
        paidAt: new Date(),
      },
      include: {
        branch: true,
        customer: true,
        serviceType: true,
        assignedTechnician: true,
      },
    });
  }

  async collectFeedback(serviceOrderId: string, dto: CustomerFeedbackDto) {
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: {
        assignedTechnician: true,
      },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    if (serviceOrder.status !== 'delivered') {
      throw new BadRequestException('Feedback can only be collected for delivered services');
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          customerRating: dto.rating,
          customerFeedback: dto.feedback,
          feedbackDate: new Date(),
        },
      });

      // Update technician rating (placeholder - would need aggregation)
      // This would typically update a technician performance record

      // Flag for review if rating < 3
      if (dto.rating < 3) {
        // In production, this would create a review task or notification
      }

      return updated;
    });
  }
}



