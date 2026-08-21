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
    const { branchId, warehouseId, categoryId, brandId, stockStatus, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      product: {
        isActive: true,
        deletedAt: null,
      },
    };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    } else if (branchId) {
      where.branchId = branchId;
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

    // Get all product stocks
    const stocks = await this.prisma.productStock.findMany({
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
    });

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
        };
      })
      .filter((stock) => {
        if (!stockStatus) return true;
        return stock.stockStatus === stockStatus;
      });

    // Get total count
    const total = await this.prisma.productStock.count({ where });

    return {
      data: processedStocks,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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

  async getLowStockAlerts(branchId?: string) {
    const where: any = {
      product: {
        isActive: true,
        deletedAt: null,
      },
    };

    if (branchId) {
      where.branchId = branchId;
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
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (productId) {
      where.productId = productId;
    }

    if (warehouseId) {
      where.warehouseId = warehouseId;
    } else if (branchId) {
      where.branchId = branchId;
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
}

