import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreateGoodsReceiptDto } from '../dto/create-goods-receipt.dto';
import { ApproveGoodsReceiptDto } from '../dto/approve-goods-receipt.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class GoodsReceiptsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate GR number: GR-YYYYMMDD-XXXXXX
   */
  private generateGRNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `GR-${dateStr}-${random}`;
  }

  /**
   * Create goods receipt (draft)
   */
  async create(dto: CreateGoodsReceiptDto, userId: string) {
    // Validate branch
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branch_id },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Validate PO if provided
    let purchaseOrder = null;
    if (dto.purchase_order_id) {
      purchaseOrder = await this.prisma.purchaseOrder.findUnique({
        where: { id: dto.purchase_order_id },
        include: { items: true },
      });

      if (!purchaseOrder) {
        throw new NotFoundException('Purchase order not found');
      }

      if (purchaseOrder.status === 'cancelled') {
        throw new BadRequestException('Cannot receive goods from cancelled purchase order');
      }
    }

    // Validate products
    for (const item of dto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.product_id },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.product_id} not found`);
      }

      // If linked to PO item, validate
      if (item.purchase_order_item_id && purchaseOrder) {
        const poItem = purchaseOrder.items.find(
          (i) => i.id === item.purchase_order_item_id,
        );
        if (!poItem) {
          throw new NotFoundException(
            `Purchase order item ${item.purchase_order_item_id} not found`,
          );
        }
      }
    }

    // Create GR
    return await this.prisma.goodsReceipt.create({
      data: {
        grNumber: this.generateGRNumber(),
        purchaseOrderId: dto.purchase_order_id,
        branchId: dto.branch_id,
        receiptDate: new Date(dto.receipt_date),
        status: 'draft',
        internalNotes: dto.notes,
        receivedBy: userId,
        items: {
          create: dto.items.map((item) => ({
            purchaseOrderItemId: item.purchase_order_item_id,
            productId: item.product_id,
            quantityReceived: new Decimal(item.quantity_received),
            quantityAccepted: new Decimal(item.quantity_received), // Initially all accepted
            quantityRejected: new Decimal(0),
            unitPrice: new Decimal(item.unit_price),
            batchNumber: item.batch_number,
            serialNumber: item.serial_number,
            expiryDate: item.expiry_date ? new Date(item.expiry_date) : null,
            inspectionStatus: 'pending',
            notes: item.notes,
          })),
        },
      },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
            items: true,
          },
        },
        branch: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
            purchaseOrderItem: true,
          },
        },
      },
    });
  }

  /**
   * List goods receipts
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    purchaseOrderId?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.search) {
      where.OR = [
        { grNumber: { contains: params.search, mode: 'insensitive' } },
        {
          purchaseOrder: {
            poNumber: { contains: params.search, mode: 'insensitive' },
          },
        },
      ];
    }

    if (params.status && params.status !== 'all') {
      where.status = params.status;
    }

    if (params.purchaseOrderId) {
      where.purchaseOrderId = params.purchaseOrderId;
    }

    if (params.branchId) {
      where.branchId = params.branchId;
    }

    if (params.startDate || params.endDate) {
      where.receiptDate = {};
      if (params.startDate) {
        where.receiptDate.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.receiptDate.lte = new Date(params.endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.goodsReceipt.findMany({
        where,
        skip,
        take: limit,
        include: {
          purchaseOrder: {
            select: {
              id: true,
              poNumber: true,
              supplier: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          branch: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.goodsReceipt.count({ where }),
    ]);

    return {
      data: data.map((gr) => ({
        ...gr,
        items: gr.items.map((item) => ({
          ...item,
          quantityReceived: item.quantityReceived.toNumber(),
          quantityAccepted: item.quantityAccepted.toNumber(),
          quantityRejected: item.quantityRejected.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
        })),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get goods receipt by ID
   */
  async findById(id: string) {
    const gr = await this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
            items: true,
          },
        },
        branch: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
            purchaseOrderItem: {
              include: {
                product: {
                  select: {
                    id: true,
                    sku: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!gr) {
      throw new NotFoundException('Goods receipt not found');
    }

    return {
      ...gr,
      variancePercent: gr.variancePercent ? gr.variancePercent.toNumber() : null,
      items: gr.items.map((item) => ({
        ...item,
        quantityReceived: item.quantityReceived.toNumber(),
        quantityAccepted: item.quantityAccepted.toNumber(),
        quantityRejected: item.quantityRejected.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
      })),
    };
  }

  /**
   * Approve goods receipt (with stock update and variance check)
   */
  async approve(
    id: string,
    dto: ApproveGoodsReceiptDto,
    userId: string,
    userRoles: string[],
  ) {
    const gr = await this.prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          include: { items: true },
        },
        items: {
          include: {
            product: true,
            purchaseOrderItem: true,
          },
        },
        branch: true,
      },
    });

    if (!gr) {
      throw new NotFoundException('Goods receipt not found');
    }

    if (gr.status !== 'draft' && gr.status !== 'received' && gr.status !== 'inspected') {
      throw new BadRequestException(`Cannot approve goods receipt with status: ${gr.status}`);
    }

    // Check if user has approval authority (HS, SPV, CSO)
    const hasAuthority = ['HS', 'SPV', 'CSO', 'OWNER'].some((role) =>
      userRoles.includes(role),
    );

    if (!hasAuthority) {
      throw new ForbiddenException('You do not have authority to approve goods receipts');
    }

    // Calculate variance if linked to PO
    let variancePercent: Decimal | null = null;
    if (gr.purchaseOrder) {
      const poItems = gr.purchaseOrder.items;
      let totalOrdered = new Decimal(0);
      let totalReceived = new Decimal(0);

      for (const grItem of gr.items) {
        if (grItem.purchaseOrderItemId) {
          const poItem = poItems.find((i) => i.id === grItem.purchaseOrderItemId);
          if (poItem) {
            totalOrdered = totalOrdered.plus(poItem.quantityOrdered);
            totalReceived = totalReceived.plus(grItem.quantityAccepted);
          }
        }
      }

      if (totalOrdered.greaterThan(0)) {
        const variance = totalReceived.minus(totalOrdered);
        variancePercent = variance.dividedBy(totalOrdered).times(100);
      }
    }

    // Check variance < 2% (warning if > 2%)
    if (variancePercent && Math.abs(variancePercent.toNumber()) > 2) {
      // Log warning but allow approval (business rule: variance < 2% acceptable, but can be approved with notes)
    }

    // Update stock and create movements
    return await this.prisma.$transaction(async (tx) => {
      // Update stock for each item
      for (const item of gr.items) {
        if (item.quantityAccepted.lessThanOrEqualTo(0)) {
          continue; // Skip items with no accepted quantity
        }

        // Get or create product stock
        let stock = await tx.productStock.findUnique({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId: gr.branchId,
            },
          },
        });

        if (!stock) {
          stock = await tx.productStock.create({
            data: {
              productId: item.productId,
              branchId: gr.branchId,
              quantityAvailable: new Decimal(0),
              quantityReserved: new Decimal(0),
              quantityDamaged: new Decimal(0),
            },
          });
        }

        const quantityBefore = Number(stock.quantityAvailable);
        const quantityAfter = quantityBefore + item.quantityAccepted.toNumber();

        // Update stock
        await tx.productStock.update({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId: gr.branchId,
            },
          },
          data: {
            quantityAvailable: new Decimal(quantityAfter),
          },
        });

        // Create stock movement (PURCHASE, IN)
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            branchId: gr.branchId,
            movementType: 'IN',
            referenceType: 'PURCHASE',
            referenceId: gr.id,
            quantityChange: item.quantityAccepted,
            quantityBefore: new Decimal(quantityBefore),
            quantityAfter: new Decimal(quantityAfter),
            batchNumber: item.batchNumber,
            serialNumber: item.serialNumber,
            notes: `Goods receipt ${gr.grNumber} - ${item.product.name} (${item.quantityAccepted.toNumber()} unit)`,
            createdBy: userId,
          },
        });

        // Update PO item quantityReceived if linked
        if (item.purchaseOrderItemId) {
          const poItem = await tx.purchaseOrderItem.findUnique({
            where: { id: item.purchaseOrderItemId },
          });

          if (poItem) {
            const newQuantityReceived = poItem.quantityReceived.plus(item.quantityAccepted);

            await tx.purchaseOrderItem.update({
              where: { id: item.purchaseOrderItemId },
              data: {
                quantityReceived: newQuantityReceived,
              },
            });

            // Update PO status based on received quantities
            const po = await tx.purchaseOrder.findUnique({
              where: { id: poItem.purchaseOrderId },
              include: { items: true },
            });

            if (po) {
              const allReceived = po.items.every(
                (i) => i.quantityReceived.greaterThanOrEqualTo(i.quantityOrdered),
              );
              const partiallyReceived = po.items.some(
                (i) => i.quantityReceived.greaterThan(0),
              );

              let newStatus = po.status;
              if (allReceived && po.status === 'ordered') {
                newStatus = 'received';
              } else if (partiallyReceived && po.status === 'ordered') {
                newStatus = 'partially_received';
              }

              if (newStatus !== po.status) {
                await tx.purchaseOrder.update({
                  where: { id: po.id },
                  data: { status: newStatus },
                });
              }
            }
          }
        }
      }

      // Update GR status
      const updated = await tx.goodsReceipt.update({
        where: { id },
        data: {
          status: 'approved',
          inspectionStatus: dto.inspection_status || 'passed',
          inspectionNotes: dto.inspection_notes,
          variancePercent,
          inspectedBy: userId,
          inspectedAt: new Date(),
          approvedBy: userId,
          approvedAt: new Date(),
          internalNotes: dto.notes
            ? `${gr.internalNotes || ''}\n[Approval] ${dto.notes}`.trim()
            : gr.internalNotes,
        },
        include: {
          purchaseOrder: {
            include: {
              supplier: true,
              items: true,
            },
          },
          branch: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  brand: true,
                },
              },
              purchaseOrderItem: true,
            },
          },
        },
      });

      return {
        ...updated,
        variancePercent: updated.variancePercent ? updated.variancePercent.toNumber() : null,
        items: updated.items.map((item) => ({
          ...item,
          quantityReceived: item.quantityReceived.toNumber(),
          quantityAccepted: item.quantityAccepted.toNumber(),
          quantityRejected: item.quantityRejected.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
        })),
      };
    });
  }

  /**
   * Reject goods receipt
   */
  async reject(id: string, userId: string, reason: string, userRoles: string[]) {
    const gr = await this.prisma.goodsReceipt.findUnique({
      where: { id },
    });

    if (!gr) {
      throw new NotFoundException('Goods receipt not found');
    }

    if (gr.status === 'approved' || gr.status === 'rejected' || gr.status === 'cancelled') {
      throw new BadRequestException(`Cannot reject goods receipt with status: ${gr.status}`);
    }

    // Check authority
    const hasAuthority = ['HS', 'SPV', 'CSO', 'OWNER'].some((role) =>
      userRoles.includes(role),
    );

    if (!hasAuthority) {
      throw new ForbiddenException('You do not have authority to reject goods receipts');
    }

    return await this.prisma.goodsReceipt.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
            items: true,
          },
        },
        branch: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
            purchaseOrderItem: true,
          },
        },
      },
    });
  }

  /**
   * Cancel goods receipt
   */
  async cancel(id: string, userId: string, reason?: string) {
    const gr = await this.prisma.goodsReceipt.findUnique({
      where: { id },
    });

    if (!gr) {
      throw new NotFoundException('Goods receipt not found');
    }

    if (gr.status === 'approved' || gr.status === 'cancelled') {
      throw new BadRequestException(`Cannot cancel goods receipt with status: ${gr.status}`);
    }

    return await this.prisma.goodsReceipt.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: new Date(),
        cancellationReason: reason,
      },
      include: {
        purchaseOrder: {
          include: {
            supplier: true,
            items: true,
          },
        },
        branch: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
            purchaseOrderItem: true,
          },
        },
      },
    });
  }
}

