import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { ListStockDto } from './dto/list-stock.dto';
import { ListMovementsDto } from './dto/list-movements.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  async getStockSummary(query: ListStockDto) {
    const { branchId, warehouseId, categoryId, brandId, stockStatus, search, hideZero, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      product: {
        isActive: true,
        deletedAt: null,
      },
    };

    // IGDERP-88 threshold toggle: hide zero-stock rows
    if (hideZero) {
      where.quantityAvailable = { gt: 0 };
    }

    if (warehouseId) {
      where.warehouseId = warehouseId;
    } else if (branchId) {
      where.branchId = branchId;
    } else if (query.branchIds?.length) {
      // "Semua Cabang" → user's accessible branches only
      where.branchId = { in: query.branchIds };
    }

    if (categoryId) {
      where.product = {
        ...where.product,
        categoryId,
      };
    }

    if (brandId) {
      where.product = {
        ...where.product,
        brandId,
      };
    }

    if (search) {
      where.product = {
        ...where.product,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    // Get all product stocks + total + active tiers (tier list drives per-tier
    // member pricing on the client; single query, shared across the page)
    const [stocks, total, tiers] = await Promise.all([
      this.prisma.productStock.findMany({
        where,
        include: {
          product: {
            include: {
              category: true,
              brand: true,
            },
          },
          branch: true,
          warehouse: true,
        },
        skip,
        take: limit,
      }),
      this.prisma.productStock.count({ where }),
      this.prisma.customerTier.findMany({
        where: { isActive: true },
        orderBy: { level: 'asc' },
        select: { id: true, code: true, name: true, discountPercentage: true },
      }),
    ]);

    // IGDERP-91 product age: earliest date each (product, branch) pair first
    // held stock > 0 (first positive stockMovement). One aggregate query
    // for the whole page; rows without history get ageDays: null.
    const ageByPair = new Map<string, number | null>();
    if (stocks.length) {
      const firstPositive = await this.prisma.stockMovement.groupBy({
        by: ['productId', 'branchId'],
        where: {
          productId: { in: stocks.map((s: any) => s.productId) },
          branchId: { in: [...new Set(stocks.map((s: any) => s.branchId))] },
          quantityAfter: { gt: 0 },
        },
        _min: { createdAt: true },
      });
      const now = Date.now();
      for (const row of firstPositive) {
        const minDate = row._min.createdAt ? new Date(row._min.createdAt).getTime() : null;
        ageByPair.set(
          `${row.productId}::${row.branchId}`,
          minDate === null ? null : Math.max(0, Math.floor((now - minDate) / 86400000)),
        );
      }
    }

    // Calculate stock status and filter
    const processedStocks = stocks
      .map((stock) => {
        const totalStock = Number(stock.quantityAvailable);
        const reorderPoint = stock.reorderPoint ? Number(stock.reorderPoint) : null;
        let status: 'low' | 'out' | 'available' = 'available';

        if (totalStock === 0) {
          status = 'out';
        } else if (reorderPoint && totalStock <= reorderPoint) {
          status = 'low';
        }

        return {
          ...stock,
          stockStatus: status,
          totalStock,
          ageDays: ageByPair.get(`${stock.productId}::${stock.branchId}`) ?? null,
        };
      })
      .filter((stock) => {
        if (!stockStatus) return true;
        return stock.stockStatus === stockStatus;
      });

    return {
      data: processedStocks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        tiers: tiers.map((t: any) => ({
          ...t,
          discountPercentage: Number(t.discountPercentage),
        })),
      },
    };
  }

  async getProductStock(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
        brand: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const stocks = await this.prisma.productStock.findMany({
      where: { productId },
      include: {
        branch: true,
        warehouse: true,
      },
    });

    return {
      product,
      stocks: stocks.map((stock) => ({
        ...stock,
        quantityAvailable: Number(stock.quantityAvailable),
        quantityReserved: Number(stock.quantityReserved),
        quantityDamaged: Number(stock.quantityDamaged),
        minStock: stock.minStock ? Number(stock.minStock) : null,
        maxStock: stock.maxStock ? Number(stock.maxStock) : null,
        reorderPoint: stock.reorderPoint ? Number(stock.reorderPoint) : null,
      })),
    };
  }

  async adjustStock(dto: StockAdjustmentDto, userId: string) {
    const {
      productId,
      warehouseId,
      branchId: legacyBranchId,
      type,
      quantityChange,
      reason,
      notes,
      batchNumber,
      serialNumber,
    } = dto;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // warehouseId is authoritative. Legacy branchId resolves to the outlet's
    // oldest active GOOD warehouse until all callers have migrated.
    const warehouse = warehouseId
      ? await this.prisma.warehouse.findUnique({ where: { id: warehouseId } })
      : legacyBranchId
        ? await this.prisma.warehouse.findFirst({
            where: {
              outletId: legacyBranchId,
              type: 'GOOD',
              scope: 'OUTLET',
              isActive: true,
            },
            orderBy: { createdAt: 'asc' },
          })
        : null;

    if (!warehouse) {
      throw new NotFoundException(
        warehouseId ? 'Warehouse not found' : 'An active outlet warehouse is required',
      );
    }

    if (!warehouse.isActive) {
      throw new BadRequestException('Cannot adjust stock in an inactive warehouse');
    }

    const effectiveBranchId = warehouse.outletId;
    let stock = await this.prisma.productStock.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId: warehouse.id,
        },
      },
    });

    if (!stock) {
      stock = await this.prisma.productStock.create({
        data: {
          productId,
          warehouseId: warehouse.id,
          branchId: effectiveBranchId,
          quantityAvailable: new Decimal(0),
          quantityReserved: new Decimal(0),
          quantityDamaged: new Decimal(0),
        },
      });
    }

    let actualQuantityChange = quantityChange;
    let movementType = 'ADJUSTMENT';

    if (type === 'OUT' || type === 'DAMAGE') {
      actualQuantityChange = -Math.abs(quantityChange);
      movementType = type === 'DAMAGE' ? 'ADJUSTMENT' : 'OUT';
    } else if (type === 'IN' || type === 'FOUND' || type === 'CORRECTION') {
      actualQuantityChange = Math.abs(quantityChange);
      movementType = 'ADJUSTMENT';
    }

    if (actualQuantityChange < 0) {
      const available = Number(stock.quantityAvailable);
      if (available + actualQuantityChange < 0) {
        throw new BadRequestException('Insufficient stock for adjustment');
      }
    }

    const quantityBefore = Number(stock.quantityAvailable);
    const quantityAfter = quantityBefore + actualQuantityChange;

    return await this.prisma.$transaction(async (tx) => {
      const updatedStock = await tx.productStock.update({
        where: {
          productId_warehouseId: {
            productId,
            warehouseId: warehouse.id,
          },
        },
        data: {
          quantityAvailable: new Decimal(quantityAfter),
          quantityDamaged:
            type === 'DAMAGE'
              ? new Decimal(Number(stock.quantityDamaged) + Math.abs(quantityChange))
              : stock.quantityDamaged,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId,
          warehouseId: warehouse.id,
          branchId: effectiveBranchId,
          movementType,
          referenceType: 'ADJUSTMENT',
          quantityChange: new Decimal(actualQuantityChange),
          quantityBefore: new Decimal(quantityBefore),
          quantityAfter: new Decimal(quantityAfter),
          batchNumber,
          serialNumber,
          notes: `${reason}${notes ? ` - ${notes}` : ''}`,
          createdBy: userId,
        },
      });

      return updatedStock;
    });
  }

  async getLowStockAlerts(branchId?: string, branchIds?: string[]) {
    const where: any = {
      product: {
        isActive: true,
        deletedAt: null,
      },
    };

    if (branchId) {
      where.branchId = branchId;
    } else if (branchIds?.length) {
      // "Semua Cabang" → user's accessible branches only
      where.branchId = { in: branchIds };
    }

    // Get stocks with reorder point set
    const stocks = await this.prisma.productStock.findMany({
      where: {
        ...where,
        reorderPoint: { not: null },
      },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
          },
        },
        branch: true,
        warehouse: true,
      },
    });

    // Filter stocks where quantity <= reorder_point
    const lowStockItems = stocks
      .map((stock) => {
        const available = Number(stock.quantityAvailable);
        const reorderPoint = Number(stock.reorderPoint!);
        const costPrice = Number(stock.product.costPrice);

        return {
          ...stock,
          quantityAvailable: available,
          reorderPoint,
          isLowStock: available <= reorderPoint,
          suggestedOrderQuantity: reorderPoint * 2 - available, // Order up to 2x reorder point
          estimatedCost: (reorderPoint * 2 - available) * costPrice,
        };
      })
      .filter((item) => item.isLowStock)
      .sort((a, b) => a.quantityAvailable - b.quantityAvailable); // Sort by lowest stock first

    // Group by branch
    const groupedByBranch = lowStockItems.reduce((acc, item) => {
      const branchName = item.branch?.name ?? item.warehouse.name;
      if (!acc[branchName]) {
        acc[branchName] = [];
      }
      acc[branchName].push(item);
      return acc;
    }, {} as Record<string, typeof lowStockItems>);

    return {
      totalAlerts: lowStockItems.length,
      byBranch: groupedByBranch,
      items: lowStockItems,
    };
  }

  async getStockMovementHistory(query: ListMovementsDto) {
    const {
      productId,
      warehouseId,
      branchId,
      movementType,
      referenceType,
      startDate,
      endDate,
      search,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (productId) {
      where.productId = productId;
    }

    // IGDERP-90 detail mode: product/barcode search (global mode omits it)
    if (search) {
      where.product = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
          { barcode: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    if (warehouseId) {
      where.warehouseId = warehouseId;
    } else if (branchId) {
      where.branchId = branchId;
    } else if (query.branchIds?.length) {
      // "Semua Cabang" → user's accessible branches only
      where.branchId = { in: query.branchIds };
    }

    if (movementType) {
      where.movementType = movementType;
    }

    if (referenceType) {
      where.referenceType = referenceType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        include: {
          product: {
            include: {
              category: true,
              brand: true,
            },
          },
          branch: true,
        warehouse: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);

    return {
      data: movements.map((movement) => ({
        ...movement,
        quantityChange: Number(movement.quantityChange),
        quantityBefore: Number(movement.quantityBefore),
        quantityAfter: Number(movement.quantityAfter),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * IGDERP-106 — stock CSV export honoring the active list filters.
   * `columns` is a comma-separated subset of EXPORT_COLUMNS; unknown keys
   * are ignored so a stale FE selection can never break the download.
   */
  static readonly EXPORT_COLUMNS: Record<string, { header: string; pick: (row: any, tiers: any[]) => string }> = {
    sku: { header: 'SKU', pick: (r) => r.product?.sku ?? '' },
    product: { header: 'Produk', pick: (r) => r.product?.name ?? '' },
    barcode: { header: 'Barcode', pick: (r) => r.product?.barcode ?? '' },
    branch: { header: 'Cabang', pick: (r) => r.branch?.name ?? '' },
    warehouse: { header: 'Gudang', pick: (r) => r.warehouse?.name ?? '' },
    available: { header: 'Stok Tersedia', pick: (r) => String(r.totalStock ?? r.quantityAvailable ?? 0) },
    minStock: { header: 'Min Stock', pick: (r) => String(r.minStock ?? 0) },
    reorderPoint: { header: 'Reorder Point', pick: (r) => (r.reorderPoint ?? '') as string },
    regularPrice: { header: 'Harga Reguler', pick: (r) => String(r.product?.sellingPrice ?? 0) },
    memberPrice: {
      header: 'Harga Member (Gold 10%)',
      pick: (r, tiers) => {
        const base = Number(r.product?.sellingPrice ?? 0);
        const gold = tiers.find((t: any) => t.code === 'GOLD') ?? tiers.find((t: any) => Number(t.discountPercentage) > 0);
        if (!gold) return String(base);
        return String(Math.round(base * (1 - Number(gold.discountPercentage) / 100)));
      },
    },
    ageDays: { header: 'Umur Stok (hari)', pick: (r) => (r.ageDays ?? '') as string },
    stockValue: {
      header: 'Nilai Stok',
      pick: (r) => String(Number(r.product?.costPrice ?? 0) * Number(r.totalStock ?? r.quantityAvailable ?? 0)),
    },
  };

  async exportStockCsv(query: ListStockDto, columns?: string) {
    const keys = (columns?.split(',').map((c) => c.trim()).filter(Boolean) ?? []).filter(
      (c) => c in StockService.EXPORT_COLUMNS,
    );
    const picked = keys.length ? keys : Object.keys(StockService.EXPORT_COLUMNS);

    // Reuse the list query (filters applied, no pagination for export)
    const { data, meta } = await this.getStockSummary({ ...query, page: 1, limit: 5000 });
    const tiers = (meta as any).tiers ?? [];

    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [picked.map((k) => StockService.EXPORT_COLUMNS[k].header).join(',')];
    for (const row of data as any[]) {
      lines.push(picked.map((k) => escape(StockService.EXPORT_COLUMNS[k].pick(row, tiers))).join(','));
    }
    return lines.join('\n');
  }
}

