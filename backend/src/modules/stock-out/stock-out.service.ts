import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateStockOutDto, StockOutItemDto } from './dto/create-stock-out.dto';
import { Decimal } from '@prisma/client/runtime/library';

interface MergedLine {
  productId: string;
  quantity: number;
  unitId?: string;
  stockValue?: number;
}

@Injectable()
export class StockOutService {
  constructor(private prisma: PrismaService) {}

  private generateDocumentNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `SOUT-${dateStr}-${random}`;
  }

  /**
   * Merge duplicate product lines: sum quantity, keep the first explicit
   * stockValue/unitId for the line.
   */
  private mergeItems(items: StockOutItemDto[]): MergedLine[] {
    const merged = new Map<string, MergedLine>();
    for (const item of items) {
      const existing = merged.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
        if (existing.stockValue === undefined && item.stockValue !== undefined) {
          existing.stockValue = item.stockValue;
        }
        if (!existing.unitId && item.unitId) {
          existing.unitId = item.unitId;
        }
      } else {
        merged.set(item.productId, {
          productId: item.productId,
          quantity: item.quantity,
          unitId: item.unitId,
          stockValue: item.stockValue,
        });
      }
    }
    return Array.from(merged.values());
  }

  /**
   * Create a Stock Out document atomically:
   * - StockOut + StockOutItem rows
   * - ProductStock decrement by warehouse (must exist with enough quantity)
   * - StockMovement OUT rows (referenceType STOCK_OUT, negative quantityChange)
   * No GL / cash / sales / purchase / finance transaction is created.
   */
  async create(dto: CreateStockOutDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one product line is required');
    }

    const lines = this.mergeItems(dto.items);

    // ── Warehouse: outlet-owned GOOD warehouse OR the system-scoped Central Bad Stock warehouse ──
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    if (!warehouse.isActive) {
      throw new BadRequestException('Cannot remove stock from an inactive warehouse');
    }

    let outletId: string | null = null;
    const isOutletGood = warehouse.type === 'GOOD' && warehouse.scope === 'OUTLET';
    const isSystemBad = warehouse.type === 'BAD' && warehouse.scope === 'SYSTEM';

    if (isOutletGood) {
      if (!dto.outletId) {
        throw new BadRequestException('Outlet is required for an outlet warehouse');
      }
      const outlet = await this.prisma.branch.findUnique({
        where: { id: dto.outletId },
      });
      if (!outlet) {
        throw new NotFoundException('Outlet not found');
      }
      if (warehouse.outletId !== dto.outletId) {
        throw new BadRequestException(
          'Selected warehouse must belong to the selected outlet',
        );
      }
      outletId = warehouse.outletId;
    } else if (!isSystemBad) {
      throw new BadRequestException(
        'Selected warehouse must be an outlet GOOD warehouse or the Central Bad Stock warehouse',
      );
    }

    // ── Products + stock value defaults (Product.minSellingPrice) ──
    const productIds = lines.map((l) => l.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { unit: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const unitIds = lines
      .map((l) => l.unitId || productMap.get(l.productId)?.unitId)
      .filter((id): id is string => !!id);
    const units = unitIds.length
      ? await this.prisma.unit.findMany({ where: { id: { in: unitIds } } })
      : [];
    const unitMap = new Map(units.map((u) => [u.id, u]));

    const resolvedLines = lines.map((line) => {
      const product = productMap.get(line.productId);
      if (!product) {
        throw new NotFoundException(`Product ${line.productId} not found`);
      }
      const stockValue =
        line.stockValue !== undefined
          ? line.stockValue
          : product.minSellingPrice !== null && product.minSellingPrice !== undefined
            ? Number(product.minSellingPrice)
            : Number(product.sellingPrice);
      const unitId = line.unitId || product.unitId || undefined;
      const unitName = unitId ? unitMap.get(unitId)?.name || null : null;
      return {
        productId: line.productId,
        productName: product.name,
        productSku: product.sku,
        quantity: line.quantity,
        unitId,
        unitName,
        stockValue,
      };
    });

    const documentDate = dto.date ? new Date(dto.date) : new Date();
    const documentNumber = this.generateDocumentNumber();

    return await this.prisma.$transaction(async (tx) => {
      const stockOut = await tx.stockOut.create({
        data: {
          documentNumber,
          outletId,
          warehouseId: dto.warehouseId,
          documentDate,
          reason: dto.reason,
          createdBy: userId,
          items: {
            create: resolvedLines.map((line) => {
              const lineTotal = new Decimal(line.quantity)
                .mul(new Decimal(line.stockValue))
                .toDecimalPlaces(2);
              return {
                productId: line.productId,
                productName: line.productName,
                productSku: line.productSku,
                quantity: new Decimal(line.quantity),
                unitId: line.unitId,
                unitName: line.unitName,
                stockValue: new Decimal(line.stockValue),
                lineTotal,
              };
            }),
          },
        },
        include: { items: true },
      });

      // Per-line stock decrement + StockMovement OUT rows
      for (const line of resolvedLines) {
        const stock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: warehouse.id,
            },
          },
        });

        const quantityBefore = stock ? Number(stock.quantityAvailable) : 0;
        if (!stock || quantityBefore < line.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${line.productName}" (available: ${quantityBefore}, requested: ${line.quantity})`,
          );
        }
        const quantityAfter = quantityBefore - line.quantity;

        await tx.productStock.update({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: warehouse.id,
            },
          },
          data: {
            quantityAvailable: new Decimal(quantityAfter),
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            warehouseId: warehouse.id,
            branchId: outletId,
            movementType: 'OUT',
            referenceType: 'STOCK_OUT',
            referenceId: stockOut.id,
            quantityChange: new Decimal(-line.quantity),
            quantityBefore: new Decimal(quantityBefore),
            quantityAfter: new Decimal(quantityAfter),
            notes: `Stock Out: ${documentNumber} - ${dto.reason}`,
            createdBy: userId,
          },
        });
      }

      const totalValue = resolvedLines.reduce(
        (sum, line) => sum.add(new Decimal(line.quantity).mul(new Decimal(line.stockValue))),
        new Decimal(0),
      );

      return tx.stockOut.update({
        where: { id: stockOut.id },
        data: { totalValue: totalValue.toDecimalPlaces(2) },
        include: {
          items: { include: { product: true } },
          outlet: true,
          warehouse: true,
        },
      });
    }).then((doc) => this.serialize(doc));
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    outletId?: string;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.outletId) where.outletId = query.outletId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.startDate || query.endDate) {
      where.documentDate = {};
      if (query.startDate) where.documentDate.gte = new Date(query.startDate);
      if (query.endDate) where.documentDate.lte = new Date(query.endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.stockOut.findMany({
        where,
        include: {
          items: { include: { product: true } },
          outlet: true,
          warehouse: true,
        },
        orderBy: { documentDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockOut.count({ where }),
    ]);

    return {
      data: data.map((doc) => this.serialize(doc)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const doc = await this.prisma.stockOut.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        outlet: true,
        warehouse: true,
      },
    });
    if (!doc) {
      throw new NotFoundException('Stock Out document not found');
    }
    return this.serialize(doc);
  }

  private serialize(doc: any) {
    return {
      ...doc,
      totalValue: Number(doc.totalValue),
      items: doc.items.map((item: any) => ({
        ...item,
        quantity: Number(item.quantity),
        stockValue: Number(item.stockValue),
        lineTotal: Number(item.lineTotal),
      })),
    };
  }

  // ── Supporting lists for the Stock Out form ──

  /**
   * Source warehouse candidates: active GOOD OUTLET warehouses (optionally
   * scoped to an outlet) PLUS the single system-scoped Central Bad Stock
   * warehouse (which does not require an outlet).
   */
  async findSourceWarehouses(outletId?: string) {
    const goodsWhere: any = {
      type: 'GOOD',
      scope: 'OUTLET',
      isActive: true,
    };
    if (outletId) goodsWhere.outletId = outletId;

    const [goods, systemBad] = await Promise.all([
      this.prisma.warehouse.findMany({
        where: goodsWhere,
        select: { id: true, code: true, name: true, type: true, scope: true, outletId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.warehouse.findMany({
        where: { type: 'BAD', scope: 'SYSTEM', isActive: true },
        select: { id: true, code: true, name: true, type: true, scope: true, outletId: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return [...goods, ...systemBad];
  }

  /**
   * Product search for the line picker (includes pricing defaults for lines).
   * When warehouseId is provided, each result also carries the available
   * quantity in that warehouse so the picker can show remaining stock.
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
        sellingPrice: true,
        minSellingPrice: true,
        memberPricing: true,
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
      sellingPrice: Number(p.sellingPrice),
      minSellingPrice: p.minSellingPrice !== null ? Number(p.minSellingPrice) : null,
      availableQuantity: stockMap.get(p.id) ?? 0,
    }));
  }
}
