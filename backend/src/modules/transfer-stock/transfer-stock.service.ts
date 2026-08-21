import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  CreateTransferStockDto,
  TransferStockItemDto,
} from './dto/create-transfer-stock.dto';
import { Decimal } from '@prisma/client/runtime/library';

interface MergedLine {
  productId: string;
  quantity: number;
}

@Injectable()
export class TransferStockService {
  constructor(private prisma: PrismaService) {}

  private generateDocumentNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `TRF-${dateStr}-${random}`;
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

  /**
   * Create a completed Transfer Stock document atomically:
   * - StockTransfer + StockTransferItem rows (status 'completed')
   * - Source ProductStock decrement (must exist with enough quantity)
   * - Destination ProductStock increment (row created when missing,
   *   e.g. first movement into Central Bad Stock)
   * - StockMovement OUT row at source + IN row at destination
   *   (referenceType TRANSFER, referenceId = transfer id)
   * No GL / cash / sales / purchase / finance transaction is created —
   * the movement is quantity-only.
   */
  async create(dto: CreateTransferStockDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one product line is required');
    }

    const lines = this.mergeItems(dto.items);

    // ── Source: outlet + outlet-owned GOOD warehouse ──
    const outlet = await this.prisma.branch.findUnique({
      where: { id: dto.outletId },
    });
    if (!outlet) {
      throw new NotFoundException('Source outlet not found');
    }

    const fromWarehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!fromWarehouse) {
      throw new NotFoundException('Source warehouse not found');
    }
    if (!fromWarehouse.isActive) {
      throw new BadRequestException('Cannot transfer from an inactive warehouse');
    }
    if (fromWarehouse.type !== 'GOOD' || fromWarehouse.scope !== 'OUTLET') {
      throw new BadRequestException(
        'Source must be an outlet GOOD warehouse',
      );
    }
    if (fromWarehouse.outletId !== dto.outletId) {
      throw new BadRequestException(
        'Source warehouse must belong to the selected source outlet',
      );
    }

    // ── Destination: outlet warehouse (different outlet) or Central Bad Stock ──
    let toWarehouse: {
      id: string;
      code: string;
      name: string;
      type: string;
      scope: string;
      outletId: string | null;
      isActive: boolean;
    };
    let toOutletId: string | null = null;

    if (dto.destinationMode === 'outlet') {
      if (!dto.toOutletId || !dto.toWarehouseId) {
        throw new BadRequestException(
          'Destination outlet and warehouse are required for outlet transfer',
        );
      }
      if (dto.toOutletId === dto.outletId) {
        throw new BadRequestException(
          'Cannot transfer to the same outlet',
        );
      }
      const toOutlet = await this.prisma.branch.findUnique({
        where: { id: dto.toOutletId },
      });
      if (!toOutlet) {
        throw new NotFoundException('Destination outlet not found');
      }
      const dest = await this.prisma.warehouse.findUnique({
        where: { id: dto.toWarehouseId },
      });
      if (!dest) {
        throw new NotFoundException('Destination warehouse not found');
      }
      if (!dest.isActive) {
        throw new BadRequestException('Cannot transfer to an inactive warehouse');
      }
      if (dest.type !== 'GOOD' || dest.scope !== 'OUTLET') {
        throw new BadRequestException(
          'Destination must be an outlet GOOD warehouse',
        );
      }
      if (dest.outletId !== dto.toOutletId) {
        throw new BadRequestException(
          'Destination warehouse must belong to the destination outlet',
        );
      }
      toWarehouse = dest;
      toOutletId = dto.toOutletId;
    } else {
      if (dto.toOutletId || dto.toWarehouseId) {
        throw new BadRequestException(
          'Central Bad Stock destination does not require an outlet or warehouse',
        );
      }
      const centralBad = await this.prisma.warehouse.findFirst({
        where: { type: 'BAD', scope: 'SYSTEM', isActive: true },
      });
      if (!centralBad) {
        throw new NotFoundException(
          'Central Bad Stock warehouse not found',
        );
      }
      toWarehouse = centralBad;
    }

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
          fromBranchId: outlet.id,
          toBranchId: toOutletId,
          transferType: 'regular',
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
            branchId: outlet.id,
            movementType: 'OUT',
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            quantityChange: new Decimal(-line.quantity),
            quantityBefore: new Decimal(srcBefore),
            quantityAfter: new Decimal(srcAfter),
            notes: `Transfer: ${documentNumber} - ${fromWarehouse.name} → ${toWarehouse.name}`,
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
              branchId: toOutletId,
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
            branchId: toOutletId,
            movementType: 'IN',
            referenceType: 'TRANSFER',
            referenceId: transfer.id,
            quantityChange: new Decimal(line.quantity),
            quantityBefore: new Decimal(dstBefore),
            quantityAfter: new Decimal(dstAfter),
            notes: `Transfer: ${documentNumber} - ${fromWarehouse.name} → ${toWarehouse.name}`,
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

    const where: any = {};
    if (query.outletId) {
      where.OR = [{ fromBranchId: query.outletId }, { toBranchId: query.outletId }];
    }
    if (query.warehouseId) {
      where.OR = [
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
    if (!doc) {
      throw new NotFoundException('Transfer document not found');
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

  // ── Supporting lists for the Transfer Stock form ──

  /**
   * Active GOOD OUTLET warehouses — optionally scoped to an outlet.
   * Used for both the source warehouse and the destination warehouse
   * (outlet mode).
   */
  async findWarehouses(outletId?: string) {
    const where: any = {
      type: 'GOOD',
      scope: 'OUTLET',
      isActive: true,
    };
    if (outletId) where.outletId = outletId;

    return this.prisma.warehouse.findMany({
      where,
      select: { id: true, code: true, name: true, type: true, scope: true, outletId: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * The single system-scoped Central Bad Stock warehouse (BAD, SYSTEM).
   * Exactly one active row is enforced by a unique partial index.
   */
  async findCentralBad() {
    const centralBad = await this.prisma.warehouse.findFirst({
      where: { type: 'BAD', scope: 'SYSTEM', isActive: true },
      select: { id: true, code: true, name: true, type: true, scope: true, outletId: true },
    });
    if (!centralBad) {
      throw new NotFoundException('Central Bad Stock warehouse not found');
    }
    return centralBad;
  }

  /**
   * Product search for the line picker. When warehouseId (the source
   * warehouse) is provided, each result carries the available quantity in
   * that warehouse so the picker can show remaining stock.
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
