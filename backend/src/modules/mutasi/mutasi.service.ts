import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateMutasiDto } from './dto/create-mutasi.dto';
import {
  TransferStockItemDto,
} from '../transfer-stock/dto/create-transfer-stock.dto';
import { Decimal } from '@prisma/client/runtime/library';

interface MergedLine {
  productId: string;
  quantity: number;
}

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  scope: string;
  outletId: string | null;
  isActive: boolean;
};

/**
 * Mutasi (IGDERP-140) — CENTRAL ↔ OUTLET + OUTLET ↔ OUTLET movement.
 *
 * Executed by SODO (purchasing team) under permission key `inventory.mutasi`.
 * Same contract as Transfer Stock v1 (IGDERP-78): quantity-only, atomic
 * OUT/IN, StockMovement rows, no GL/cash/sales/purchase transaction.
 *
 * Valid combinations:
 *  - SYSTEM (GOOD|BAD — central-good / central-bad) ↔ OUTLET/GOOD — either direction
 *  - OUTLET/GOOD ↔ OUTLET/GOOD — only when the outlets differ
 * Rejected: same warehouse, SYSTEM ↔ SYSTEM, OUTLET ↔ OUTLET of one outlet
 * (intra-outlet same-outlet moves are Transfer Stock, IGDERP-139).
 */
@Injectable()
export class MutasiService {
  constructor(private prisma: PrismaService) {}

  private generateDocumentNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `MUT-${dateStr}-${random}`;
  }

  /**
   * Merge duplicate product lines: sum quantity.
   */
  private mergeItems(items: TransferStockItemDto[]): MergedLine[] {
    const merged = new Map<string, MergedLine>();
    for (const item of items) {
      const existing = merged.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        merged.set(item.productId, {
          productId: item.productId,
          quantity: item.quantity,
        });
      }
    }
    return Array.from(merged.values());
  }

  private isValidMoveWarehouse(w: WarehouseRow): boolean {
    // Outlet GOOD warehouses and system-scoped central warehouses are both
    // valid move endpoints; outlet BAD warehouses are not part of the model.
    if (!w.isActive) return false;
    if (w.scope === 'SYSTEM') return w.type === 'GOOD' || w.type === 'BAD';
    return w.type === 'GOOD' && !!w.outletId;
  }

  /**
   * Validate the pair (from/to) against the Mutasi rules.
   */
  private validatePair(from: WarehouseRow, to: WarehouseRow) {
    if (from.id === to.id) {
      throw new BadRequestException(
        'Source and destination warehouse must differ',
      );
    }
    if (from.scope === 'SYSTEM' && to.scope === 'SYSTEM') {
      throw new BadRequestException(
        'Central-to-central moves are not allowed; use central ↔ outlet only',
      );
    }
    if (from.scope === 'OUTLET' && to.scope === 'OUTLET') {
      if (from.outletId === to.outletId) {
        throw new BadRequestException(
          'Same-outlet moves are Transfer Stock (IGDERP-139), not Mutasi',
        );
      }
    }
  }

  private async resolveWarehouse(id: string, label: string): Promise<WarehouseRow> {
    const wh = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!wh) {
      throw new NotFoundException(`${label} warehouse not found`);
    }
    if (!this.isValidMoveWarehouse(wh)) {
      throw new BadRequestException(
        `${label} warehouse is not a valid move endpoint (outlet GOOD or system central warehouse)`,
      );
    }
    return wh;
  }

  /**
   * Create a completed Mutasi document atomically:
   * - StockTransfer + StockTransferItem rows (status 'completed',
   *   transferType 'mutasi')
   * - Source ProductStock decrement (must exist with enough quantity)
   * - Destination ProductStock increment (row created when missing)
   * - StockMovement OUT at source + IN at destination (referenceType TRANSFER)
   * No GL / cash / sales / purchase / finance transaction is created.
   */
  async create(dto: CreateMutasiDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one product line is required');
    }

    const fromWarehouse = await this.resolveWarehouse(
      dto.fromWarehouseId,
      'Source',
    );
    const toWarehouse = await this.resolveWarehouse(dto.toWarehouseId, 'Destination');
    this.validatePair(fromWarehouse, toWarehouse);

    const lines = this.mergeItems(dto.items);

    // ── Products + snapshots ──
    const productIds = lines.map((l) => l.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const resolvedLines = lines.map((line) => {
      const product = productMap.get(line.productId);
      if (!product) {
        throw new NotFoundException(`Product ${line.productId} not found`);
      }
      return {
        productId: line.productId,
        productName: product.name,
        productSku: product.sku,
        quantity: line.quantity,
      };
    });

    const documentNumber = this.generateDocumentNumber();

    return await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          transferNumber: documentNumber,
          fromWarehouseId: fromWarehouse.id,
          toWarehouseId: toWarehouse.id,
          fromBranchId: fromWarehouse.outletId,
          toBranchId: toWarehouse.outletId,
          transferType: 'mutasi',
          status: 'completed',
          requestedBy: userId,
          notes: dto.notes,
          items: {
            create: resolvedLines.map((line) => ({
              productId: line.productId,
              productName: line.productName,
              productSku: line.productSku,
              quantityRequested: new Decimal(line.quantity),
              quantitySent: new Decimal(line.quantity),
              quantityReceived: new Decimal(line.quantity),
            })),
          },
        },
        include: { items: true },
      });

      // Per-line: source OUT + destination IN + StockMovement rows
      for (const line of resolvedLines) {
        // ── Source OUT ──
        const srcStock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: fromWarehouse.id,
            },
          },
        });
        const srcBefore = srcStock ? Number(srcStock.quantityAvailable) : 0;
        if (!srcStock || srcBefore < line.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${line.productName}" (available: ${srcBefore}, requested: ${line.quantity})`,
          );
        }
        const srcAfter = srcBefore - line.quantity;
        await tx.productStock.update({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: fromWarehouse.id,
            },
          },
          data: {
            quantityAvailable: new Decimal(srcAfter),
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            warehouseId: fromWarehouse.id,
            branchId: fromWarehouse.outletId,
            movementType: 'OUT',
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            quantityChange: new Decimal(-line.quantity),
            quantityBefore: new Decimal(srcBefore),
            quantityAfter: new Decimal(srcAfter),
            notes: `Mutasi: ${documentNumber} - ${fromWarehouse.name} → ${toWarehouse.name}`,
            createdBy: userId,
          },
        });

        // ── Destination IN (create row when missing) ──
        const dstStock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: toWarehouse.id,
            },
          },
        });
        const dstBefore = dstStock ? Number(dstStock.quantityAvailable) : 0;
        const dstAfter = dstBefore + line.quantity;
        if (dstStock) {
          await tx.productStock.update({
            where: {
              productId_warehouseId: {
                productId: line.productId,
                warehouseId: toWarehouse.id,
              },
            },
            data: {
              quantityAvailable: new Decimal(dstAfter),
            },
          });
        } else {
          await tx.productStock.create({
            data: {
              productId: line.productId,
              warehouseId: toWarehouse.id,
              branchId: toWarehouse.outletId,
              quantityAvailable: new Decimal(dstAfter),
              quantityReserved: new Decimal(0),
              quantityDamaged: new Decimal(0),
            },
          });
        }
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            warehouseId: toWarehouse.id,
            branchId: toWarehouse.outletId,
            movementType: 'IN',
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            quantityChange: new Decimal(line.quantity),
            quantityBefore: new Decimal(dstBefore),
            quantityAfter: new Decimal(dstAfter),
            notes: `Mutasi: ${documentNumber} - ${fromWarehouse.name} → ${toWarehouse.name}`,
            createdBy: userId,
          },
        });
      }

      const doc = await tx.stockTransfer.findUnique({
        where: { id: transfer.id },
        include: {
          items: { include: { product: true } },
          fromWarehouse: true,
          toWarehouse: true,
          fromBranch: true,
          toBranch: true,
        },
      });
      return this.serialize(doc);
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    outletId?: string;
    warehouseId?: string;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: any = { transferType: 'mutasi' };
    if (query.outletId) {
      where.OR = [{ fromBranchId: query.outletId }, { toBranchId: query.outletId }];
    }
    if (query.warehouseId) {
      where.OR = [
        ...(where.OR || []),
        { fromWarehouseId: query.warehouseId },
        { toWarehouseId: query.warehouseId },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        where,
        include: {
          items: { include: { product: true } },
          fromWarehouse: true,
          toWarehouse: true,
          fromBranch: true,
          toBranch: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    const requestedBys = Array.from(
      new Set(data.map((d) => d.requestedBy).filter(Boolean)),
    );
    const users = requestedBys.length
      ? await this.prisma.user.findMany({
          where: { id: { in: requestedBys } },
          select: { id: true, fullName: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.fullName]));

    return {
      data: data.map((doc) => ({
        ...this.serialize(doc),
        picName: doc.requestedBy ? userMap.get(doc.requestedBy) || null : null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const doc = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        fromWarehouse: true,
        toWarehouse: true,
        fromBranch: true,
        toBranch: true,
      },
    });
    if (!doc || doc.transferType !== 'mutasi') {
      throw new NotFoundException('Mutasi document not found');
    }

    let picName: string | null = null;
    if (doc.requestedBy) {
      const user = await this.prisma.user.findUnique({
        where: { id: doc.requestedBy },
        select: { id: true, fullName: true },
      });
      picName = user?.fullName || null;
    }

    return { ...this.serialize(doc), picName };
  }

  private serialize(doc: any) {
    return {
      ...doc,
      items: (doc.items || []).map((item: any) => ({
        ...item,
        quantityRequested: Number(item.quantityRequested),
        quantitySent: item.quantitySent !== null ? Number(item.quantitySent) : null,
        quantityReceived:
          item.quantityReceived !== null ? Number(item.quantityReceived) : null,
      })),
    };
  }

  // ── Supporting lists for the Mutasi form ──

  /**
   * All active move-endpoint warehouses: system central warehouses
   * (central-good / central-bad) + outlet GOOD warehouses, each carrying its
   * outlet info so the UI can group/sort them (central first, then per outlet).
   */
  async findWarehouses() {
    return this.prisma.warehouse.findMany({
      where: {
        isActive: true,
        OR: [
          { scope: 'SYSTEM' },
          { type: 'GOOD', scope: 'OUTLET' },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        scope: true,
        outletId: true,
        outlet: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ scope: 'asc' }, { type: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Product search for the line picker, with available quantity in the
   * selected source warehouse.
   */
  async searchProducts(q?: string, limit = 15, warehouseId?: string) {
    const where: any = {
      isActive: true,
      deletedAt: null,
    };
    if (q && q.trim().length > 0) {
      where.OR = [
        { name: { contains: q.trim(), mode: 'insensitive' } },
        { sku: { contains: q.trim(), mode: 'insensitive' } },
        { barcode: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }
    const products = await this.prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        unitId: true,
        unit: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
      take: Math.min(limit, 50),
    });

    let stockMap = new Map<string, number>();
    if (warehouseId) {
      const stocks = await this.prisma.productStock.findMany({
        where: {
          productId: { in: products.map((p) => p.id) },
          warehouseId,
        },
        select: { productId: true, quantityAvailable: true },
      });
      stockMap = new Map(
        stocks.map((s) => [s.productId, Number(s.quantityAvailable)]),
      );
    }

    return products.map((p) => ({
      ...p,
      availableQuantity: stockMap.get(p.id) ?? 0,
    }));
  }
}
