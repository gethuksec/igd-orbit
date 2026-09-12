import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreatePurchaseReturnDto } from '../dto/create-purchase-return.dto';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * IGDERP-84 (S4): Retur Pembelian — purchase returns per supplier invoice.
 *
 * Two creation modes:
 *  - PO mode: pick a received PO → lines capped at received − already returned,
 *    unit price snapshotted from the PO; 1 invoice = 1 return (second → blocked).
 *  - Manual mode (first system deploy / pre-system invoices without PO data):
 *    supplier + free invoice number + manual unit prices; no cap from a PO
 *    (limited by available central-good stock).
 *
 * Stock semantics (locked decisions): central-good −qty (leaves the sellable
 * pool); the physical unit parks in central-bad until shipped back to supplier.
 */
@Injectable()
export class PurchaseReturnsService {
  constructor(private prisma: PrismaService) {}

  /** Generate return number: RTP-YYYYMMDD-XXXXXX. */
  private generateReturnNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `RTP-${dateStr}-${random}`;
  }

  private async getCentralWarehouses() {
    const goodWarehouse = await this.prisma.warehouse.findFirst({
      where: { type: 'GOOD', scope: 'SYSTEM', isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    const badWarehouse = await this.prisma.warehouse.findFirst({
      where: { type: 'BAD', scope: 'SYSTEM', isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!goodWarehouse || !badWarehouse) {
      throw new BadRequestException(
        'Central Good/Bad Stock warehouse not found — apply prisma/inventory-warehouse-stock.sql',
      );
    }
    return { goodWarehouse, badWarehouse };
  }

  async create(dto: CreatePurchaseReturnDto, userId: string) {
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('Alasan retur wajib diisi');
    }
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Minimal satu item untuk diretur');
    }

    // Merge duplicate lines for the same product.
    const merged = new Map<
      string,
      { quantity: number; unitPrice?: number; reason?: string; notes?: string }
    >();
    for (const line of dto.items) {
      if (!line.quantity || line.quantity <= 0) {
        throw new BadRequestException('Jumlah retur harus lebih dari 0');
      }
      const prev = merged.get(line.product_id);
      merged.set(line.product_id, {
        quantity: (prev?.quantity || 0) + line.quantity,
        unitPrice: line.unit_price ?? prev?.unitPrice,
        reason: line.reason ?? prev?.reason,
        notes: line.notes ?? prev?.notes,
      });
    }

    const productIds = [...merged.keys()];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });
    const productById = new Map(products.map((p) => [p.id, p]));
    for (const pid of productIds) {
      if (!productById.has(pid)) {
        throw new BadRequestException(`Produk ${pid} tidak ditemukan`);
      }
    }

    const isManual = !dto.purchase_order_id;
    let po: any = null;
    let supplierId: string;
    let invoiceNumber: string;
    const returnedByProduct = new Map<string, number>();

    if (isManual) {
      // Manual mode — pre-system invoices (no PO data in the system yet).
      if (!dto.supplier_id) {
        throw new BadRequestException('Supplier wajib diisi untuk retur manual');
      }
      if (!dto.invoice_number || !dto.invoice_number.trim()) {
        throw new BadRequestException('Nomor invoice supplier wajib diisi');
      }
      const supplier = await this.prisma.customer.findUnique({
        where: { id: dto.supplier_id },
        select: { id: true },
      });
      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
      supplierId = dto.supplier_id;
      invoiceNumber = dto.invoice_number.trim();
    } else {
      // PO mode — lines capped at received − already returned (1 invoice = 1 return).
      po = await this.prisma.purchaseOrder.findUnique({
        where: { id: dto.purchase_order_id },
        include: { items: true },
      });
      if (!po) {
        throw new NotFoundException('Purchase order not found');
      }
      if (po.status !== 'received' && po.status !== 'partially_received') {
        throw new BadRequestException(
          'Retur pembelian hanya untuk PO yang sudah diterima (received / partially_received)',
        );
      }
      const existing = await this.prisma.purchaseReturn.findFirst({
        where: { purchaseOrderId: po.id },
        select: { returnNumber: true },
      });
      if (existing) {
        throw new BadRequestException(
          `Retur untuk invoice ini sudah dibuat (${existing.returnNumber})`,
        );
      }
      const priorReturns = await this.prisma.purchaseReturnItem.findMany({
        where: { purchaseReturn: { purchaseOrderId: po.id } },
        select: { productId: true, quantity: true },
      });
      for (const r of priorReturns) {
        returnedByProduct.set(
          r.productId,
          (returnedByProduct.get(r.productId) || 0) + Number(r.quantity),
        );
      }
      supplierId = po.supplierId;
      invoiceNumber = po.invoiceNumber || '';
    }

    const poItemByProduct = new Map<string, any>(
      (po?.items || []).map((i: any) => [i.productId, i] as [string, any]),
    );
    const lines: Array<{
      productId: string;
      quantity: Decimal;
      unitPrice: Decimal;
      subtotal: Decimal;
      reason?: string;
      notes?: string;
      productName: string;
    }> = [];

    for (const [productId, { quantity, unitPrice, reason, notes }] of merged.entries()) {
      let price: Decimal;
      if (isManual) {
        if (unitPrice == null) {
          throw new BadRequestException(
            'Harga satuan wajib diisi pada retur manual',
          );
        }
        if (unitPrice <= 0) {
          throw new BadRequestException('Harga satuan harus lebih dari 0');
        }
        price = new Decimal(unitPrice);
      } else {
        const poItem = poItemByProduct.get(productId);
        if (!poItem) {
          throw new BadRequestException(
            `Produk ${productId} tidak ada pada PO ini`,
          );
        }
        const received = Number(poItem.quantityReceived);
        const already = returnedByProduct.get(productId) || 0;
        if (quantity > received - already) {
          throw new BadRequestException(
            `Jumlah retur melebihi jumlah diterima (maks ${received - already})`,
          );
        }
        price = new Decimal(poItem.unitPrice);
      }
      lines.push({
        productId,
        quantity: new Decimal(quantity),
        unitPrice: price,
        subtotal: price.times(quantity),
        reason,
        notes,
        productName: productById.get(productId)?.name || productId,
      });
    }

    const { goodWarehouse, badWarehouse } = await this.getCentralWarehouses();
    const returnNumber = this.generateReturnNumber();

    return await this.prisma.$transaction(async (tx) => {
      const totalQty = lines.reduce((s, l) => s + Number(l.quantity), 0);
      const totalValue = lines.reduce(
        (s, l) => s.plus(l.subtotal),
        new Decimal(0),
      );

      const created = await tx.purchaseReturn.create({
        data: {
          returnNumber,
          purchaseOrderId: po?.id ?? null,
          supplierId,
          invoiceNumber: invoiceNumber || null,
          processedBy: userId,
          reason: dto.reason.trim(),
          notes: dto.notes ?? null,
          totalQty: new Decimal(totalQty),
          totalValue,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              subtotal: l.subtotal,
              reason: l.reason ?? null,
              notes: l.notes ?? null,
            })),
          },
        },
      });

      for (const line of lines) {
        const qty = Number(line.quantity);

        // Central-good −qty
        const goodStock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: goodWarehouse.id,
            },
          },
        });
        const goodBefore = goodStock ? Number(goodStock.quantityAvailable) : 0;
        if (goodBefore < qty) {
          throw new BadRequestException(
            `Stok central-good tidak cukup untuk retur (${line.productName}: tersedia ${goodBefore})`,
          );
        }
        const goodAfter = goodBefore - qty;
        await tx.productStock.update({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: goodWarehouse.id,
            },
          },
          data: { quantityAvailable: new Decimal(goodAfter) },
        });
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            warehouseId: goodWarehouse.id,
            branchId: null,
            movementType: 'OUT',
            referenceType: 'PURCHASE_RETURN',
            referenceId: created.id,
            quantityChange: new Decimal(-qty),
            quantityBefore: new Decimal(goodBefore),
            quantityAfter: new Decimal(goodAfter),
            notes: `Retur pembelian ${returnNumber} — ${line.productName} (${qty} unit)`,
            createdBy: userId,
          },
        });

        // Central-bad +qty (parks until shipped back to the supplier)
        let badStock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: badWarehouse.id,
            },
          },
        });
        if (!badStock) {
          badStock = await tx.productStock.create({
            data: {
              productId: line.productId,
              warehouseId: badWarehouse.id,
              branchId: null,
              quantityAvailable: new Decimal(0),
              quantityReserved: new Decimal(0),
              quantityDamaged: new Decimal(0),
            },
          });
        }
        const badBefore = Number(badStock.quantityAvailable);
        const badAfter = badBefore + qty;
        await tx.productStock.update({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: badWarehouse.id,
            },
          },
          data: { quantityAvailable: new Decimal(badAfter) },
        });
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            warehouseId: badWarehouse.id,
            branchId: null,
            movementType: 'IN',
            referenceType: 'PURCHASE_RETURN',
            referenceId: created.id,
            quantityChange: new Decimal(qty),
            quantityBefore: new Decimal(badBefore),
            quantityAfter: new Decimal(badAfter),
            notes: `Retur pembelian ${returnNumber} — parkir central-bad (menunggu dikirim ke supplier)`,
            createdBy: userId,
          },
        });
      }

      const full = await tx.purchaseReturn.findUnique({
        where: { id: created.id },
        include: {
          purchaseOrder: {
            select: { id: true, poNumber: true, invoiceNumber: true, status: true },
          },
          supplier: { select: { id: true, name: true, customerCode: true } },
          processedByUser: { select: { id: true, fullName: true } },
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } },
          },
        },
      });
      return this.mapReturn(full);
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    purchaseOrderId?: string;
  }) {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = Math.min(params.limit || 20, 100);
    const where: any = {};
    if (params.purchaseOrderId) where.purchaseOrderId = params.purchaseOrderId;
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { returnNumber: { contains: q, mode: 'insensitive' } },
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { purchaseOrder: { poNumber: { contains: q, mode: 'insensitive' } } },
        { supplier: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.purchaseReturn.findMany({
        where,
        include: {
          purchaseOrder: { select: { id: true, poNumber: true, status: true } },
          supplier: { select: { id: true, name: true, customerCode: true } },
          processedByUser: { select: { id: true, fullName: true } },
          items: { select: { id: true, quantity: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.purchaseReturn.count({ where }),
    ]);
    return {
      data: data.map((r) => this.mapReturn(r)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const found = await this.prisma.purchaseReturn.findUnique({
      where: { id },
      include: {
        purchaseOrder: {
          select: { id: true, poNumber: true, invoiceNumber: true, status: true },
        },
        supplier: { select: { id: true, name: true, customerCode: true } },
        processedByUser: { select: { id: true, fullName: true } },
        completedByUser: { select: { id: true, fullName: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    });
    if (!found) {
      throw new NotFoundException('Purchase return not found');
    }
    return this.mapReturn(found);
  }

  /**
   * Completion: the physical units are shipped back to the supplier —
   * central-bad −qty + an audit movement. One-way (open → completed).
   */
  async complete(id: string, userId: string, notes?: string) {
    const ret = await this.prisma.purchaseReturn.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!ret) {
      throw new NotFoundException('Purchase return not found');
    }
    if (ret.status === 'completed') {
      throw new BadRequestException('Retur ini sudah diselesaikan');
    }

    const badWarehouse = await this.prisma.warehouse.findFirst({
      where: { type: 'BAD', scope: 'SYSTEM', isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!badWarehouse) {
      throw new BadRequestException(
        'Central Bad Stock warehouse not found — apply prisma/inventory-warehouse-stock.sql',
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      for (const item of ret.items) {
        const qty = Number(item.quantity);
        const badStock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: badWarehouse.id,
            },
          },
        });
        const before = badStock ? Number(badStock.quantityAvailable) : 0;
        if (before < qty) {
          throw new BadRequestException(
            `Stok central-bad tidak cukup untuk menyelesaikan retur (butuh ${qty}, tersedia ${before})`,
          );
        }
        const after = before - qty;
        await tx.productStock.update({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: badWarehouse.id,
            },
          },
          data: { quantityAvailable: new Decimal(after) },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: badWarehouse.id,
            branchId: null,
            movementType: 'OUT',
            referenceType: 'PURCHASE_RETURN',
            referenceId: ret.id,
            quantityChange: new Decimal(-qty),
            quantityBefore: new Decimal(before),
            quantityAfter: new Decimal(after),
            notes: `Retur pembelian ${ret.returnNumber} — dikirim ke supplier (selesai)`,
            createdBy: userId,
          },
        });
      }

      const updated = await tx.purchaseReturn.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          completedBy: userId,
          completionNotes: notes?.trim() || null,
        },
        include: {
          purchaseOrder: {
            select: { id: true, poNumber: true, invoiceNumber: true, status: true },
          },
          supplier: { select: { id: true, name: true, customerCode: true } },
          processedByUser: { select: { id: true, fullName: true } },
          completedByUser: { select: { id: true, fullName: true } },
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } },
          },
        },
      });
      return this.mapReturn(updated);
    });
  }

  /** Decimal → number mapping for API output (Prisma Decimals serialize as strings). */
  private mapReturn(r: any) {
    if (!r) return r;
    const num = (v: any) =>
      v instanceof Decimal ? v.toNumber() : v == null ? v : Number(v);
    return {
      ...r,
      totalQty: num(r.totalQty),
      totalValue: num(r.totalValue),
      items: (r.items || []).map((i: any) => ({
        ...i,
        quantity: num(i.quantity),
        unitPrice: num(i.unitPrice),
        subtotal: num(i.subtotal),
      })),
    };
  }
}
