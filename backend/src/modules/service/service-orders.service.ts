import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
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
import { ProcessPaymentDto } from './dto/payment.dto';
import { JournalEntriesService } from '../finance/services/journal-entries.service';
import { buildPerWordSearch } from '../../shared/services/search.utils';

@Injectable()
export class ServiceOrdersService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => JournalEntriesService))
    private journalEntriesService?: JournalEntriesService,
  ) {}

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

  private async generateQuotationNumber(branchId: string): Promise<string> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { code: true },
    });

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const lastOrder = await this.prisma.serviceOrder.findFirst({
      where: {
        quotationNumber: {
          startsWith: `Q-SRV-${branch?.code || 'BR'}-${year}${month}`,
        },
      },
      orderBy: {
        quotationNumber: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastOrder && lastOrder.quotationNumber) {
      const parts = lastOrder.quotationNumber.split('-');
      const lastNum = parseInt(parts[parts.length - 1] || '0');
      nextNumber = lastNum + 1;
    }

    return `Q-SRV-${branch?.code || 'BR'}-${year}${month}-${String(nextNumber).padStart(6, '0')}`;
  }

  private async generateInvoiceNumber(branchId: string): Promise<string> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { code: true },
    });

    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');

    const lastOrder = await this.prisma.serviceOrder.findFirst({
      where: {
        invoiceNumber: {
          startsWith: `INV-SRV-${branch?.code || 'BR'}-${year}${month}`,
        },
      },
      orderBy: {
        invoiceNumber: 'desc',
      },
    });

    let nextNumber = 1;
    if (lastOrder && lastOrder.invoiceNumber) {
      const parts = lastOrder.invoiceNumber.split('-');
      const lastNum = parseInt(parts[parts.length - 1] || '0');
      nextNumber = lastNum + 1;
    }

    return `INV-SRV-${branch?.code || 'BR'}-${year}${month}-${String(nextNumber).padStart(6, '0')}`;
  }


  async create(dto: CreateServiceOrderDto, userId: string, branchId: string) {
    const {
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      customerAlternatePhone,
      deviceType,
      deviceUnit,
      deviceColor,
      deviceSerial,
      deviceImei,
      devicePassword,
      deviceCondition,
      accessoriesIncluded,
      complaint,
      initialDiagnosis,
      serviceTypeId,
      serviceSubType,
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
          serviceSubType,
          customerName,
          customerPhone,
          customerEmail,
          customerAlternatePhone,
          deviceType,
          deviceUnit,
          deviceColor,
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
      const perWord = buildPerWordSearch(search, [
        'serviceNumber',
        'internalNumber',
        'customerName',
        'customerPhone',
        'deviceUnit',
        'deviceColor',
      ]);
      if (perWord) {
        where.AND = perWord.AND;
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
          include: {
            changedByUser: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
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
    // Quoted price is now auto-calculated from laborCost + partsCost
    // No need to check quotedPrice input

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
      // Labor cost can be set after diagnosed status
      if (dto.laborCost !== undefined) {
        if (dto.status === 'diagnosed' || serviceOrder.status === 'diagnosed') {
          updateData.laborCost = new Decimal(dto.laborCost);
        }
      }

      // Discount and promo code
      if (dto.discountAmount !== undefined) {
        updateData.discountAmount = new Decimal(dto.discountAmount);
      }

      if (dto.promoCode !== undefined) {
        updateData.promoCode = dto.promoCode;
      }

      // Update relevant timestamps and generate numbers
      if (dto.status === 'quoted') {
        updateData.quotedAt = new Date();
        // Generate quotation number if not already set
        if (!serviceOrder.quotationNumber) {
          updateData.quotationNumber = await this.generateQuotationNumber(serviceOrder.branchId);
        }
        // Auto-calculate quoted price: laborCost + partsCost
        const laborCost = dto.laborCost !== undefined 
          ? Number(dto.laborCost) 
          : Number(serviceOrder.laborCost || 0);
        const partsCost = Number(serviceOrder.partsCost || 0);
        updateData.quotedPrice = new Decimal(laborCost + partsCost);
      } else if (dto.status === 'approved') {
        updateData.approvedAt = new Date();
        // Approved price can be different from quoted price (with discount)
        if (dto.customerApprovedPrice !== undefined) {
          updateData.customerApprovedPrice = new Decimal(dto.customerApprovedPrice);
        }
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

        // Determine purchase type: internal if stock available, external if not
        // For now, default to internal if stock exists, but can be overridden by DTO
        const purchaseType = part.purchaseType || (available >= part.quantity ? 'internal' : 'external');

        // Create service parts used record
        await tx.servicePartsUsed.create({
          data: {
            serviceOrderId,
            productId: part.productId,
            purchaseType,
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

        // Deduct from inventory ONLY if purchase type is 'internal'
        if (purchaseType === 'internal') {
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

          // Create stock movement ONLY for internal purchases
          await tx.stockMovement.create({
            data: {
              productId: part.productId,
              branchId: serviceOrder.branchId,
              movementType: 'OUT',
              referenceType: 'SERVICE',
              referenceId: null, // Foreign key constraint only for SalesTransaction, so set null for SERVICE
              quantityChange: new Decimal(-part.quantity),
              quantityBefore: new Decimal(quantityBefore),
              quantityAfter: new Decimal(quantityAfter),
              batchNumber: part.batchNumber,
              serialNumber: part.serialNumber,
              notes: `Parts used for service ${serviceOrder.serviceNumber} (ID: ${serviceOrderId}) - Internal`,
              createdBy: userId,
            },
          });
        }

        totalPartsCost += Number(totalCost);
        totalPartsPrice += Number(totalPrice);
      }

      // Update service order with total parts price (selling price, not cost)
      // partsCost field stores the price charged to customer, not the cost
      const newPartsCost = Number(serviceOrder.partsCost) + totalPartsPrice;
      
      return tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          partsCost: new Decimal(newPartsCost),
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

  async removePart(serviceOrderId: string, partId: string, userId: string) {
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
        `Cannot remove parts from service order with status: ${serviceOrder.status}`,
      );
    }

    const part = await this.prisma.servicePartsUsed.findUnique({
      where: { id: partId },
      include: {
        product: true,
      },
    });

    if (!part) {
      throw new NotFoundException('Service part not found');
    }

    if (part.serviceOrderId !== serviceOrderId) {
      throw new BadRequestException('Part does not belong to this service order');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Get current stock
      const stock = await tx.productStock.findUnique({
        where: {
          productId_branchId: {
            productId: part.productId,
            branchId: serviceOrder.branchId,
          },
        },
      });

      if (!stock) {
        throw new BadRequestException('Product stock not found');
      }

      // Restore stock
      const quantityBefore = Number(stock.quantityAvailable);
      const quantityAfter = quantityBefore + Number(part.quantity);

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

      // Create stock movement for return
      await tx.stockMovement.create({
        data: {
          productId: part.productId,
          branchId: serviceOrder.branchId,
          movementType: 'IN',
          referenceType: 'SERVICE',
          referenceId: null,
          quantityChange: new Decimal(Number(part.quantity)),
          quantityBefore: new Decimal(quantityBefore),
          quantityAfter: new Decimal(quantityAfter),
          batchNumber: part.batchNumber,
          serialNumber: part.serialNumber,
          notes: `Part removed from service ${serviceOrder.serviceNumber} (ID: ${serviceOrderId})`,
          createdBy: userId,
        },
      });

      // Delete service part
      await tx.servicePartsUsed.delete({
        where: { id: partId },
      });

      // Recalculate total parts cost
      const remainingParts = await tx.servicePartsUsed.findMany({
        where: { serviceOrderId },
      });

      const newPartsCost = remainingParts.reduce(
        (sum, p) => sum + Number(p.totalPrice),
        0,
      );

      // Update service order
      return tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          partsCost: new Decimal(newPartsCost),
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
    // Total = (approvedPrice or quotedPrice) * 1.11 (11% tax)
    // approvedPrice = quotedPrice - discountAmount
    const quotedPrice = Number(serviceOrder.quotedPrice || 0);
    const approvedPrice = Number(serviceOrder.customerApprovedPrice || quotedPrice);
    const discountAmount = Number(serviceOrder.discountAmount || 0);
    const finalPrice = approvedPrice - discountAmount; // Price after discount
    const taxAmount = Math.round(finalPrice * 0.11);
    const totalPrice = Math.round(finalPrice * 1.11); // Total includes 11% tax (rounded)

    // Calculate warranty expiry date
    const warrantyExpiryDate = new Date();
    warrantyExpiryDate.setDate(warrantyExpiryDate.getDate() + serviceOrder.warrantyDays);

    return this.prisma.serviceOrder.update({
      where: { id: serviceOrderId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        finalPrice: new Decimal(finalPrice),
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
      deviceUnit: serviceOrder.deviceUnit,
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

  async deliverService(serviceOrderId: string, userId: string) {
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: {
        branch: true,
      },
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
    const wasPaidBefore = serviceOrder.paymentStatus === 'paid';
    const totalPrice = Number(serviceOrder.totalPrice || 0);

    const updated = await this.prisma.serviceOrder.update({
      where: { id: serviceOrderId },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        paymentStatus: 'paid', // Assuming payment collected on delivery
        paidAt: serviceOrder.paidAt || new Date(),
      },
      include: {
        branch: true,
        customer: true,
        serviceType: true,
        assignedTechnician: true,
      },
    });

    // Auto-generate journal entry when delivered and paid (if not already created)
    if (
      this.journalEntriesService &&
      !wasPaidBefore &&
      totalPrice > 0 &&
      serviceOrder.paymentMethod
    ) {
      try {
        await this.journalEntriesService.autoGenerateFromServicePayment(
          serviceOrderId,
          serviceOrder.branchId,
          totalPrice,
          serviceOrder.paymentMethod || 'cash',
          userId,
        );
      } catch (error) {
        // Don't fail delivery if journal creation fails
        console.error('Error creating auto journal entry on delivery:', error);
      }
    }

    return updated;
  }

  async processPayment(serviceOrderId: string, dto: ProcessPaymentDto, _userId: string) {
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: {
        branch: true,
      },
    });

    if (!serviceOrder) {
      throw new NotFoundException('Service order not found');
    }

    if (serviceOrder.paymentStatus === 'paid') {
      throw new BadRequestException('Service order is already paid');
    }

    const totalPrice = Number(serviceOrder.totalPrice || 0);
    if (dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than 0');
    }

    if (dto.amount > totalPrice) {
      throw new BadRequestException('Payment amount cannot exceed total price');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Generate invoice number if not already set
      let invoiceNumber = serviceOrder.invoiceNumber;
      if (!invoiceNumber) {
        invoiceNumber = await this.generateInvoiceNumber(serviceOrder.branchId);
      }

      // Determine payment status
      let paymentStatus: 'pending' | 'partial' | 'paid' = 'paid';
      if (dto.amount < totalPrice) {
        paymentStatus = 'partial';
      }

      const updated = await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: {
          invoiceNumber,
          paymentStatus,
          paymentMethod: dto.paymentMethod,
          paidAt: paymentStatus === 'paid' ? new Date() : serviceOrder.paidAt,
          internalNotes: serviceOrder.internalNotes
            ? `${serviceOrder.internalNotes}\n\nPayment: ${dto.amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })} via ${dto.paymentMethod}${dto.reference ? ` (Ref: ${dto.reference})` : ''}${dto.notes ? `\nNotes: ${dto.notes}` : ''}`
            : `Payment: ${dto.amount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })} via ${dto.paymentMethod}${dto.reference ? ` (Ref: ${dto.reference})` : ''}${dto.notes ? `\nNotes: ${dto.notes}` : ''}`,
        },
        include: {
          branch: true,
          customer: true,
          partsUsed: {
            include: {
              product: true,
            },
          },
        },
      });

      // Auto-generate journal entry (outside transaction to avoid circular dependency)
      if (this.journalEntriesService && paymentStatus === 'paid') {
        try {
          await this.journalEntriesService.autoGenerateFromServicePayment(
            serviceOrderId,
            serviceOrder.branchId,
            dto.amount,
            dto.paymentMethod,
            _userId,
          );
        } catch (error) {
          // Don't fail payment if journal creation fails
          console.error('Error creating auto journal entry for service payment:', error);
        }
      }

      return updated;
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



