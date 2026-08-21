import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateStockInDto, StockInItemDto } from './dto/create-stock-in.dto';
import { Decimal } from '@prisma/client/runtime/library';

/** Sentinel persisted when a Stock In has no supplier (explicit choice, not NULL). */
export const NO_SUPPLIER = 'NO_SUPPLIER';

interface MergedLine {
  productId: string;
  quantity: number;
  unitId?: string;
  stockValue?: number;
}

@Injectable()
export class StockInService {
  constructor(private prisma: PrismaService) {}

  private generateDocumentNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `SIN-${dateStr}-${random}`;
  }

  /**
   * Merge duplicate product lines: sum quantity, keep the first explicit
   * stockValue/unitId for the line.
   */
  private mergeItems(items: StockInItemDto[]): MergedLine[] {
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
   * Create a Stock In document atomically:
   * - StockIn + StockInItem rows
   * - ProductStock increment by warehouse (create row when absent)
   * - StockMovement IN rows (referenceType STOCK_IN)
   * No GL / cash / sales / purchase transaction is created.
   */
  async create(dto: CreateStockInDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one product line is required');
    }

    const lines = this.mergeItems(dto.items);

    // ── Outlet ──
    const outlet = await this.prisma.branch.findUnique({
      where: { id: dto.outletId },
    });
    if (!outlet) {
      throw new NotFoundException('Outlet not found');
    }

    // ── Warehouse: must belong to the selected outlet and be an active GOOD outlet warehouse ──
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    if (warehouse.outletId !== dto.outletId) {
      throw new BadRequestException(
        'Selected warehouse must belong to the selected outlet',
      );
    }
    if (warehouse.type !== 'GOOD' || warehouse.scope !== 'OUTLET') {
      throw new BadRequestException('Selected warehouse must be a GOOD outlet warehouse');
    }
    if (!warehouse.isActive) {
      throw new BadRequestException('Cannot receive stock in an inactive warehouse');
    }

    // ── Supplier: real supplier or the NO_SUPPLIER sentinel ──
    let supplierName: string | null = null;
    if (dto.supplierId && dto.supplierId !== NO_SUPPLIER) {
      const supplier = await this.prisma.customer.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplier || supplier.customerType !== 'wholesale') {
        throw new BadRequestException('Supplier not found');
      }
      supplierName = supplier.name;
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
      const stockIn = await tx.stockIn.create({
        data: {
          documentNumber,
          outletId: dto.outletId,
          warehouseId: dto.warehouseId,
          supplierId: dto.supplierId || NO_SUPPLIER,
          supplierName,
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

      // Per-line stock increment + StockMovement IN rows
      for (const line of resolvedLines) {
        let stock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: warehouse.id,
            },
          },
        });

        const quantityBefore = stock ? Number(stock.quantityAvailable) : 0;
        const quantityAfter = quantityBefore + line.quantity;

        if (stock) {
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
        } else {
          await tx.productStock.create({
            data: {
              productId: line.productId,
              warehouseId: warehouse.id,
              branchId: warehouse.outletId,
              quantityAvailable: new Decimal(quantityAfter),
              quantityReserved: new Decimal(0),
              quantityDamaged: new Decimal(0),
            },
          });
        }

        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            warehouseId: warehouse.id,
            branchId: warehouse.outletId,
            movementType: 'IN',
            referenceType: 'STOCK_IN',
            referenceId: stockIn.id,
            quantityChange: new Decimal(line.quantity),
            quantityBefore: new Decimal(quantityBefore),
            quantityAfter: new Decimal(quantityAfter),
            notes: `Stock In: ${documentNumber} - ${dto.reason}`,
            createdBy: userId,
          },
        });
      }

      const totalValue = resolvedLines.reduce(
        (sum, line) => sum.add(new Decimal(line.quantity).mul(new Decimal(line.stockValue))),
        new Decimal(0),
      );

      return tx.stockIn.update({
        where: { id: stockIn.id },
        data: { totalValue: totalValue.toDecimalPlaces(2) },
        include: {
          items: { include: { product: true } },
          outlet: true,
          warehouse: true,
        },
      });
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    outletId?: string;
    warehouseId?: string;
    supplierId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.outletId) where.outletId = query.outletId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.startDate || query.endDate) {
      where.documentDate = {};
      if (query.startDate) where.documentDate.gte = new Date(query.startDate);
      if (query.endDate) where.documentDate.lte = new Date(query.endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.stockIn.findMany({
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
      this.prisma.stockIn.count({ where }),
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
    const doc = await this.prisma.stockIn.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        outlet: true,
        warehouse: true,
      },
    });
    if (!doc) {
      throw new NotFoundException('Stock In document not found');
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

  // ── Supporting lists for the Stock In form ──

  /** Active GOOD OUTLET warehouses for an outlet (destination candidates). */
  async findGoodWarehouses(outletId?: string) {
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

  /** Product search for the line picker (includes pricing defaults for lines). */
  async searchProducts(q?: string, limit = 15) {
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
    return products.map((p) => ({
      ...p,
      sellingPrice: Number(p.sellingPrice),
      minSellingPrice: p.minSellingPrice !== null ? Number(p.minSellingPrice) : null,
    }));
  }

  /** Active customer tiers (Silver/Gold/Platinum) for the Add Product dialog. */
  async getTiers() {
    const tiers = await this.prisma.customerTier.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, level: true },
      orderBy: { level: 'asc' },
    });
    return tiers;
  }
}
