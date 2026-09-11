import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from '../dto/update-purchase-order.dto';
import { ApprovePurchaseOrderDto } from '../dto/approve-purchase-order.dto';
import { RejectPurchaseOrderDto } from '../dto/reject-purchase-order.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate PO number: PO-YYYYMMDD-XXXXXX
   */
  private generatePONumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `PO-${dateStr}-${random}`;
  }

  /**
   * IGDERP-79 (8 Sep): due date = supplier invoice date + payment term days.
   */
  private computeDueDate(
    invoiceDate: Date | null | undefined,
    termDays?: number | null,
  ): Date | null {
    if (!invoiceDate || !termDays || termDays <= 0) {
      return null;
    }
    return new Date(invoiceDate.getTime() + termDays * 24 * 60 * 60 * 1000);
  }

  /**
   * Get required approvers based on total amount
   */
  private getRequiredApprovers(totalAmount: number): string[] {
    if (totalAmount < 5000000) {
      return ['CSO']; // < Rp 5M: CSO only
    } else if (totalAmount <= 50000000) {
      return ['CSO', 'CFO']; // Rp 5M - 50M: CSO + CFO
    } else {
      return ['CSO', 'CFO', 'OWNER']; // > Rp 50M: CSO + CFO + Owner notification
    }
  }

  /**
   * Create purchase order (submitted = pending; no draft anymore)
   */
  async create(dto: CreatePurchaseOrderDto, userId: string) {
    // Validate supplier
    const supplier = await this.prisma.customer.findUnique({
      where: { id: dto.supplier_id },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    if (supplier.customerType !== 'wholesale') {
      throw new BadRequestException('Selected customer is not a supplier (wholesale)');
    }

    // IGDERP-79 (8 Sep): supplier invoice no. + date are mandatory at creation
    if (!dto.invoice_number || !dto.invoice_number.trim()) {
      throw new BadRequestException('Nomor invoice supplier wajib diisi');
    }
    if (!dto.invoice_date) {
      throw new BadRequestException('Tanggal invoice supplier wajib diisi');
    }

    // Destination is always central-good (27 Aug §9) — the outlet selector was
    // removed from the UI (8 Sep). If the client still sends branch_id we honor
    // it; otherwise fall back to the creator's branch (operator = logged-in
    // account), then to any active branch for global users without assignments.
    let branchId = dto.branch_id;
    if (branchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: branchId },
      });

      if (!branch) {
        throw new NotFoundException('Branch not found');
      }
    } else {
      const userBranch = await this.prisma.userBranch.findFirst({
        where: { userId },
        orderBy: { isPrimary: 'desc' },
        select: { branchId: true },
      });
      branchId = userBranch?.branchId;
      if (!branchId) {
        const fallbackBranch = await this.prisma.branch.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        branchId = fallbackBranch?.id;
      }
      if (!branchId) {
        throw new BadRequestException('Tidak ada cabang aktif — hubungi administrator');
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
    }

    // Calculate totals
    let subtotal = new Decimal(0);
    const itemsData = dto.items.map((item) => {
      const unitPrice = new Decimal(item.unit_price);
      const quantity = new Decimal(item.quantity_ordered);
      const discountPercent = new Decimal(item.discount_percent || 0);
      const discountAmount = unitPrice
        .times(quantity)
        .times(discountPercent)
        .dividedBy(100);
      const itemSubtotal = unitPrice.times(quantity).minus(discountAmount);

      subtotal = subtotal.plus(itemSubtotal);

      return {
        productId: item.product_id,
        quantityOrdered: quantity,
        unitPrice,
        discountPercent,
        discountAmount,
        subtotal: itemSubtotal,
        notes: item.notes,
      };
    });

    const discountAmount = new Decimal(dto.discount_amount || 0);
    const taxAmount = new Decimal(dto.tax_amount || 0);
    const shippingCost = new Decimal(dto.shipping_cost || 0);
    const totalAmount = subtotal.minus(discountAmount).plus(taxAmount).plus(shippingCost);

    if (totalAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException('Total amount must be greater than 0');
    }

    // Create PO
    return await this.prisma.purchaseOrder.create({
      data: {
        poNumber: this.generatePONumber(),
        supplierId: dto.supplier_id,
        branchId,
        status: 'pending',
        invoiceNumber: dto.invoice_number.trim(),
        invoiceDate: new Date(dto.invoice_date),
        dueDate: this.computeDueDate(new Date(dto.invoice_date), dto.payment_term_days),
        orderDate: new Date(dto.order_date),
        expectedDeliveryDate: dto.expected_delivery_date
          ? new Date(dto.expected_delivery_date)
          : null,
        paymentTerms: dto.payment_terms,
        paymentTermDays: dto.payment_term_days,
        subtotal,
        discountAmount,
        taxAmount,
        shippingCost,
        totalAmount,
        notes: dto.notes,
        createdBy: userId,
        items: {
          create: itemsData,
        },
      },
      include: {
        supplier: true,
        branch: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * List purchase orders
   */
  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    supplierId?: string;
    branchId?: string;
    branchIds?: string[];
    startDate?: string;
    endDate?: string;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (params.search) {
      where.OR = [
        { poNumber: { contains: params.search, mode: 'insensitive' } },
        { supplier: { name: { contains: params.search, mode: 'insensitive' } } },
        { supplier: { customerCode: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    if (params.status && params.status !== 'all') {
      where.status = params.status;
    }

    if (params.supplierId) {
      where.supplierId = params.supplierId;
    }

    if (params.branchId) {
      where.branchId = params.branchId;
    } else if (params.branchIds?.length) {
      // "Semua Cabang" → user's accessible branches only
      where.branchId = { in: params.branchIds };
    }

    if (params.startDate || params.endDate) {
      where.orderDate = {};
      if (params.startDate) {
        where.orderDate.gte = new Date(params.startDate);
      }
      if (params.endDate) {
        where.orderDate.lte = new Date(params.endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          supplier: {
            select: {
              id: true,
              customerCode: true,
              name: true,
              phone: true,
              email: true,
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
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data: data.map((po) => ({
        ...po,
        subtotal: po.subtotal.toNumber(),
        discountAmount: po.discountAmount.toNumber(),
        taxAmount: po.taxAmount.toNumber(),
        shippingCost: po.shippingCost.toNumber(),
        totalAmount: po.totalAmount.toNumber(),
        items: po.items.map((item) => ({
          ...item,
          quantityOrdered: item.quantityOrdered.toNumber(),
          quantityReceived: item.quantityReceived.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
          discountPercent: item.discountPercent.toNumber(),
          discountAmount: item.discountAmount.toNumber(),
          subtotal: item.subtotal.toNumber(),
        })),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get purchase order by ID
   */
  async findById(id: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        branch: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
          },
        },
        goodsReceipts: {
          include: {
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
        },
      },
    });

    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }

    return {
      ...po,
      subtotal: po.subtotal.toNumber(),
      discountAmount: po.discountAmount.toNumber(),
      taxAmount: po.taxAmount.toNumber(),
      shippingCost: po.shippingCost.toNumber(),
      totalAmount: po.totalAmount.toNumber(),
      items: po.items.map((item) => ({
        ...item,
        quantityOrdered: item.quantityOrdered.toNumber(),
        quantityReceived: item.quantityReceived.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        discountPercent: item.discountPercent.toNumber(),
        discountAmount: item.discountAmount.toNumber(),
        subtotal: item.subtotal.toNumber(),
      })),
    };
  }

  /**
   * Update purchase order (only if draft)
   */
  async update(id: string, dto: UpdatePurchaseOrderDto, _userId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }

    if (po.status !== 'draft' && po.status !== 'pending') {
      throw new BadRequestException('Can only update draft or pending purchase orders');
    }

    if (dto.invoice_number !== undefined && !dto.invoice_number.trim()) {
      throw new BadRequestException('Nomor invoice supplier wajib diisi');
    }

    // If items are provided, recalculate totals
    let subtotal = po.subtotal;
    let itemsData = undefined;

    if (dto.items && dto.items.length > 0) {
      // Validate products
      for (const item of dto.items) {
        const product = await this.prisma.product.findUnique({
          where: { id: item.product_id },
        });

        if (!product) {
          throw new NotFoundException(`Product ${item.product_id} not found`);
        }
      }

      // Recalculate
      subtotal = new Decimal(0);
      itemsData = dto.items.map((item) => {
        const unitPrice = new Decimal(item.unit_price);
        const quantity = new Decimal(item.quantity_ordered);
        const discountPercent = new Decimal(item.discount_percent || 0);
        const discountAmount = unitPrice
          .times(quantity)
          .times(discountPercent)
          .dividedBy(100);
        const itemSubtotal = unitPrice.times(quantity).minus(discountAmount);

        subtotal = subtotal.plus(itemSubtotal);

        return {
          productId: item.product_id,
          quantityOrdered: quantity,
          unitPrice,
          discountPercent,
          discountAmount,
          subtotal: itemSubtotal,
          notes: item.notes,
        };
      });
    }

    const discountAmount = new Decimal(dto.discount_amount ?? po.discountAmount);
    const taxAmount = new Decimal(dto.tax_amount ?? po.taxAmount);
    const shippingCost = new Decimal(dto.shipping_cost ?? po.shippingCost);
    const totalAmount = subtotal.minus(discountAmount).plus(taxAmount).plus(shippingCost);

    return await this.prisma.$transaction(async (tx) => {
      // Delete existing items if new items provided
      if (itemsData) {
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });
      }

      // Update PO
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          expectedDeliveryDate: dto.expected_delivery_date
            ? new Date(dto.expected_delivery_date)
            : po.expectedDeliveryDate,
          invoiceNumber: dto.invoice_number?.trim() ?? po.invoiceNumber,
          invoiceDate: dto.invoice_date ? new Date(dto.invoice_date) : po.invoiceDate,
          dueDate: this.computeDueDate(
            dto.invoice_date ? new Date(dto.invoice_date) : po.invoiceDate,
            dto.payment_term_days ?? po.paymentTermDays,
          ),
          paymentTerms: dto.payment_terms ?? po.paymentTerms,
          paymentTermDays: dto.payment_term_days ?? po.paymentTermDays,
          subtotal,
          discountAmount,
          taxAmount,
          shippingCost,
          totalAmount,
          notes: dto.notes ?? po.notes,
          ...(itemsData && {
            items: {
              create: itemsData,
            },
          }),
        },
        include: {
          supplier: true,
          branch: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  brand: true,
                },
              },
            },
          },
        },
      });

      return {
        ...updated,
        subtotal: updated.subtotal.toNumber(),
        discountAmount: updated.discountAmount.toNumber(),
        taxAmount: updated.taxAmount.toNumber(),
        shippingCost: updated.shippingCost.toNumber(),
        totalAmount: updated.totalAmount.toNumber(),
        items: updated.items.map((item) => ({
          ...item,
          quantityOrdered: item.quantityOrdered.toNumber(),
          quantityReceived: item.quantityReceived.toNumber(),
          unitPrice: item.unitPrice.toNumber(),
          discountPercent: item.discountPercent.toNumber(),
          discountAmount: item.discountAmount.toNumber(),
          subtotal: item.subtotal.toNumber(),
        })),
      };
    });
  }

  /**
   * Approve purchase order
   */
  async approve(
    id: string,
    dto: ApprovePurchaseOrderDto,
    userId: string,
    userRoles: string[],
  ) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }

    if (po.status !== 'draft' && po.status !== 'pending') {
      throw new BadRequestException(`Cannot approve purchase order with status: ${po.status}`);
    }

    // 8 Sep decision (a4353fe9): the supplier invoice document is required
    // before approval. Reuses Approval Settings (category PURCHASE_INVOICE);
    // default ON — only an explicit OFF toggle disables it.
    const invoiceSetting = await this.prisma.approvalSetting.findUnique({
      where: { category: 'PURCHASE_INVOICE' },
    });
    const invoiceMandatory = invoiceSetting?.mandatoryInvoice ?? true;
    if (invoiceMandatory) {
      const invoiceCount = await this.prisma.purchaseAttachment.count({
        where: { entityType: 'PURCHASE_ORDER', entityId: id, documentType: 'INVOICE' },
      });
      if (invoiceCount === 0) {
        throw new BadRequestException(
          'Invoice wajib diunggah sebelum approve (sesuai pengaturan persetujuan)',
        );
      }
    }

    const totalAmount = po.totalAmount.toNumber();
    const requiredApprovers = this.getRequiredApprovers(totalAmount);
    const hasAuthority =
      requiredApprovers.some((role) => userRoles.includes(role)) ||
      userRoles.includes('SUPERADMIN');

    if (!hasAuthority) {
      throw new ForbiddenException('You do not have authority to approve this purchase order');
    }

    // Check approval level
    const isCSO = userRoles.includes('CSO');
    const isCFO = userRoles.includes('CFO');

    // First approval (CSO) — SUPERADMIN bypasses tiers (single-step full approval)
    const isSuper = userRoles.includes('SUPERADMIN');
    if (!po.approvedBy && (isCSO || isSuper)) {
      if (isSuper) {
        return await this.prisma.purchaseOrder.update({
          where: { id },
          data: {
            status: 'approved',
            approvedBy: userId,
            approvedAt: new Date(),
            notes: dto.notes ? `${po.notes || ''}\n[Admin Approval] ${dto.notes}`.trim() : po.notes,
          },
          include: {
            supplier: true,
            branch: true,
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                    brand: true,
                  },
                },
              },
            },
          },
        });
      }
      if (totalAmount >= 5000000 && totalAmount <= 50000000) {
        // Needs CFO approval too
        return await this.prisma.purchaseOrder.update({
          where: { id },
          data: {
            status: 'pending', // Still pending for CFO approval
            approvedBy: userId,
            approvedAt: new Date(),
            notes: dto.notes
              ? `${po.notes || ''}\n[CSO Approval] ${dto.notes}`.trim()
              : po.notes,
          },
          include: {
            supplier: true,
            branch: true,
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                    brand: true,
                  },
                },
              },
            },
          },
        });
      } else if (totalAmount > 50000000) {
        // Needs CFO and Owner notification
        return await this.prisma.purchaseOrder.update({
          where: { id },
          data: {
            status: 'pending', // Still pending for CFO approval
            approvedBy: userId,
            approvedAt: new Date(),
            notes: dto.notes
              ? `${po.notes || ''}\n[CSO Approval] ${dto.notes}\n[Owner Notification Required]`.trim()
              : po.notes,
          },
          include: {
            supplier: true,
            branch: true,
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                    brand: true,
                  },
                },
              },
            },
          },
        });
      } else {
        // < 5M: CSO can fully approve
        return await this.prisma.purchaseOrder.update({
          where: { id },
          data: {
            status: 'approved',
            approvedBy: userId,
            approvedAt: new Date(),
            notes: dto.notes
              ? `${po.notes || ''}\n[CSO Approval] ${dto.notes}`.trim()
              : po.notes,
          },
          include: {
            supplier: true,
            branch: true,
            items: {
              include: {
                product: {
                  include: {
                    category: true,
                    brand: true,
                  },
                },
              },
            },
          },
        });
      }
    }

    // Second approval (CFO)
    if (po.approvedBy && !po.approvedBy2 && isCFO) {
      return await this.prisma.purchaseOrder.update({
        where: { id },
        data: {
          status: 'approved',
          approvedBy2: userId,
          approvedAt: new Date(),
          notes: dto.notes
            ? `${po.notes || ''}\n[CFO Approval] ${dto.notes}`.trim()
            : po.notes,
        },
        include: {
          supplier: true,
          branch: true,
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  brand: true,
                },
              },
            },
          },
        },
      });
    }

    throw new BadRequestException('Purchase order is already fully approved or cannot be approved');
  }

  /**
   * Reject purchase order (approver denies a pending PO)
   */
  async reject(
    id: string,
    dto: RejectPurchaseOrderDto,
    userId: string,
    userRoles: string[],
  ) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id },
    });

    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }

    if (po.status !== 'pending') {
      throw new BadRequestException(`Cannot reject purchase order with status: ${po.status}`);
    }

    const totalAmount = po.totalAmount.toNumber();
    const requiredApprovers = this.getRequiredApprovers(totalAmount);
    const hasAuthority =
      requiredApprovers.some((role) => userRoles.includes(role)) ||
      userRoles.includes('SUPERADMIN');

    if (!hasAuthority) {
      throw new ForbiddenException('You do not have authority to reject this purchase order');
    }

    return await this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: dto.reason,
      },
      include: {
        supplier: true,
        branch: true,
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
          },
        },
      },
    });
  }

}

