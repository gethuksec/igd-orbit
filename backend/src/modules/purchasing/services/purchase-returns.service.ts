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
 * Stock semantics (locked decisions):
 *  - Manual return: central-good −qty (leaves the sellable pool); the physical
 *    unit parks in central-bad until it's shipped back to the supplier.
 *  - Receiving-sourced return (IGDERP-83): the rejected qty already went straight
 *    to central-bad at GR approve — this return is the supplier paperwork only.
 *  - 1 invoice = 1 return: a second return for the same PO/invoice is rejected;
 *    receiving flags merge into the existing return.
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

  /** Manual create — reduces central-good, parks the unit in central-bad. */
  async create(dto: CreatePurchaseReturnDto, userId: string) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { id: dto.purchase_order_id },
      include: { items: { include: { product: true } } },
    });
    if (!po) {
      throw new NotFoundException('Purchase order not found');
    }
    if (po.status !== 'received' && po.status !== 'partially_received') {
      throw new BadRequestException(
        'Retur pembelian hanya untuk PO yang sudah diterima (received / partially_received)',
      );
    }
    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException('Alasan retur wajib diisi');
    }
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Minimal satu item untuk diretur');
    }

    // 1 invoice = 1 return (IGDERP-84).
    const existing = await this.prisma.purchaseReturn.findFirst({
      where: { purchaseOrderId: po.id },
      select: { returnNumber: true },
    });
    if (existing) {
      throw new BadRequestException(
        `Retur untuk invoice ini sudah dibuat (${existing.returnNumber})`,
      );
    }

    // Cap per product: qty ≤ received − already returned.
    const priorReturns = await this.prisma.purchaseReturnItem.findMany({
      where: { purchaseReturn: { purchaseOrderId: po.id } },
      select: { productId: true, quantity: true },
    });
    const returnedByProduct = new Map<string, number>();
    for (const r of priorReturns) {
      returnedByProduct.set(
        r.productId,
        (returnedByProduct.get(r.productId) || 0) + Number(r.quantity),
      );
    }

    // Merge duplicate lines for the same product.
    const merged = new Map<
      string,
      { quantity: number; reason?: string; notes?: string }
    >();
    for (const line of dto.items) {
      if (!line.quantity || line.quantity <= 0) {
        throw new BadRequestException('Jumlah retur harus lebih dari 0');
      }
      const prev = merged.get(line.product_id);
      merged.set(line.product_id, {
        quantity: (prev?.quantity || 0) + line.quantity,
        reason: line.reason ?? prev?.reason,
        notes: line.notes ?? prev?.notes,
      });
    }

    const poItemByProduct = new Map(po.items.map((i) => [i.productId, i]));
    const lines: Array<{
      productId: string;
      quantity: Decimal;
      unitPrice: Decimal;
      subtotal: Decimal;
      reason?: string;
      notes?: string;
      productName: string;
    }> = [];
    for (const [productId, { quantity, reason, notes }] of merged.entries()) {
      const poItem = poItemByProduct.get(productId);
      if (!poItem) {
        throw new BadRequestException(`Produk ${productId} tidak ada pada PO ini`);
      }
      const received = Number(poItem.quantityReceived);
      const already = returnedByProduct.get(productId) || 0;
      if (quantity > received - already) {
        throw new BadRequestException(
          `Jumlah retur melebihi jumlah diterima (maks ${received - already})`,
        );
      }
      const unitPrice = new Decimal(poItem.unitPrice);
      lines.push({
        productId,
        quantity: new Decimal(quantity),
        unitPrice,
        subtotal: unitPrice.times(quantity),
        reason,
        notes,
        productName: poItem.product?.name || productId,
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
          purchaseOrderId: po.id,
          supplierId: po.supplierId,
          invoiceNumber: po.invoiceNumber ?? null,
          processedBy: userId,
          reason: dto.reason.trim(),
          notes: dto.notes ?? null,
          source: 'manual',
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

  /**
   * IGDERP-83: receiving flagged lines → the invoice's return (merge if it exists).
   * Stock is NOT touched here: rejected-at-receiving qty is already in central-bad.
   * Runs inside the GR-approve transaction.
   */
  async createReceivingReturn(
    tx: any,
    gr: any,
    flaggedItems: any[],
    userId: string,
  ) {
    const poId = gr.purchaseOrderId;
    if (!poId) {
      return null; // standalone (hibah) receipts have no invoice to return against
    }
    const po = gr.purchaseOrder || null;

    const lines = flaggedItems.map((item: any) => {
      const poItem = po?.items?.find(
        (i: any) => i.id === item.purchaseOrderItemId,
      );
      const unitPrice = new Decimal(item.unitPrice ?? poItem?.unitPrice ?? 0);
      const quantity = new Decimal(item.quantityRejected);
      return {
        productId: item.productId,
        quantity,
        unitPrice,
        subtotal: unitPrice.times(quantity),
        reason: item.inspectionNotes || 'Rusak / kurang saat penerimaan',
        notes: item.notes ?? null,
      };
    });
    const addedQty = lines.reduce(
      (s: Decimal, l: any) => s.plus(l.quantity),
      new Decimal(0),
    );
    const addedValue = lines.reduce(
      (s: Decimal, l: any) => s.plus(l.subtotal),
      new Decimal(0),
    );

    const existing = await tx.purchaseReturn.findFirst({
      where: { purchaseOrderId: poId },
    });
    if (existing) {
      await tx.purchaseReturn.update({
        where: { id: existing.id },
        data: {
          totalQty: existing.totalQty.plus(addedQty),
          totalValue: existing.totalValue.plus(addedValue),
        },
      });
      await tx.purchaseReturnItem.createMany({
        data: lines.map((l: any) => ({
          purchaseReturnId: existing.id,
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          subtotal: l.subtotal,
          reason: l.reason,
          notes: l.notes,
        })),
      });
      return existing;
    }

    return tx.purchaseReturn.create({
      data: {
        returnNumber: this.generateReturnNumber(),
        purchaseOrderId: poId,
        supplierId: po?.supplierId,
        invoiceNumber: po?.invoiceNumber ?? null,
        processedBy: userId,
        reason: `Retur dari penerimaan barang (${gr.grNumber})`,
        notes: null,
        source: 'receiving',
        totalQty: addedQty,
        totalValue: addedValue,
        items: { create: lines },
      },
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
