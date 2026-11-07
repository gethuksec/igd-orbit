import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { buildPerWordSearch } from '../../shared/services/search.utils';
import { CreateProductDto, UpdateProductDto, ListProductsDto } from './dto';
import { ProductTransformer, TransformedProduct } from './transformers/product.transformer';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

type CompareOp = 'gt' | 'lt' | 'eq';

/** Apply a gt/lt/eq compare operator onto a Prisma numeric filter object. */
function applyCompareOp(existing: any, op: CompareOp, value: number): any {
  const next = existing && typeof existing === 'object' ? { ...existing } : {};
  if (op === 'gt') next.gt = value;
  else if (op === 'lt') next.lt = value;
  else next.equals = value;
  return next;
}

/** JS-side numeric comparison for aggregation-filter id matching. */
function compareNumbers(actual: number, op: CompareOp, expected: number, float = false): boolean {
  if (op === 'gt') return actual > expected;
  if (op === 'lt') return actual < expected;
  return float ? Math.abs(actual - expected) < 1e-9 : actual === expected;
}

/** Convert an age value in the given unit to days. */
function toDays(value: number, unit: 'days' | 'months' | 'years'): number {
  if (unit === 'months') return value * 30;
  if (unit === 'years') return value * 365;
  return value;
}

/**
 * Products Service
 * Handles product management operations
 */
@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique SKU
   * Format: PROD-{timestamp}-{random}
   * @returns Generated SKU string
   */
  async generateSKU(): Promise<string> {
    let sku: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const timestamp = Date.now().toString(36).toUpperCase();
      const random = randomBytes(3).toString('hex').toUpperCase();
      sku = `PROD-${timestamp}-${random}`;

      const existing = await this.prisma.product.findUnique({
        where: { sku },
      });

      if (!existing) {
        isUnique = true;
      }

      attempts++;
    }

    if (!isUnique) {
      throw new BadRequestException('Failed to generate unique SKU after multiple attempts');
    }

    return sku!;
  }

  /**
   * Validate barcode uniqueness
   * @param barcode - Barcode to validate
   * @param excludeProductId - Product ID to exclude from check (for updates)
   * @returns True if unique, throws ConflictException otherwise
   */
  async validateBarcode(barcode: string, excludeProductId?: string): Promise<boolean> {
    const existing = await this.prisma.product.findUnique({
      where: { barcode },
    });

    if (existing && existing.id !== excludeProductId) {
      throw new ConflictException('Barcode already exists');
    }

    return true;
  }

  /**
   * Check if product can be deleted
   * @param productId - Product ID
   * @returns True if can be deleted, throws BadRequestException otherwise
   */
  async checkStockBeforeDelete(productId: string): Promise<boolean> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        productStocks: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if product has stock
    const totalStock = product.productStocks.reduce(
      (sum, stock) => sum + stock.quantityAvailable.toNumber(),
      0,
    );

    if (totalStock > 0) {
      throw new BadRequestException(
        `Cannot delete product with existing stock (${totalStock} units). Please clear stock first.`,
      );
    }

    // TODO: Check transaction history
    // For now, we'll just check stock
    // In future: Check sales_transactions, purchase_orders, etc.

    return true;
  }

  /**
   * Calculate stock summary across all branches
   * @param productId - Product ID
   * @returns Stock summary object
   */
  async calculateStockSummary(productId: string) {
    const stocks = await this.prisma.productStock.findMany({
      where: { productId },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    const totalAvailable = stocks.reduce(
      (sum, stock) => sum + stock.quantityAvailable.toNumber(),
      0,
    );
    const totalReserved = stocks.reduce(
      (sum, stock) => sum + stock.quantityReserved.toNumber(),
      0,
    );
    const totalDamaged = stocks.reduce(
      (sum, stock) => sum + stock.quantityDamaged.toNumber(),
      0,
    );

    return {
      totalAvailable,
      totalReserved,
      totalDamaged,
      totalStock: totalAvailable - totalReserved,
      branches: stocks.map((stock) => ({
        warehouseId: stock.warehouseId,
        branchId: stock.branchId,
        branchCode: stock.branch?.code || 'SYSTEM',
        branchName: stock.branch?.name || (stock as any).warehouse?.name || 'Gudang Pusat',
        available: stock.quantityAvailable.toNumber(),
        reserved: stock.quantityReserved.toNumber(),
        damaged: stock.quantityDamaged.toNumber(),
        minStock: stock.minStock?.toNumber() || null,
        maxStock: stock.maxStock?.toNumber() || null,
        reorderPoint: stock.reorderPoint?.toNumber() || null,
      })),
    };
  }

  /**
   * Find all products with pagination and filters
   * @param query - Query parameters
   * @returns Paginated list of products
   */
  async findAll(query: ListProductsDto) {
    const {
      page = 1,
      limit = 20,
      search,
      'filter[category]': filterCategory,
      'filter[subCategory]': filterSubCategory,
      'filter[brand]': filterBrand,
      'filter[color]': filterColor,
      'filter[size]': filterSize,
      'filter[unit]': filterUnit,
      'filter[supplier]': filterSupplier,
      'filter[status]': filterStatus = 'active',
      'filter[minPrice]': filterMinPrice,
      'filter[maxPrice]': filterMaxPrice,
      'filter[priceOp]': filterPriceOp,
      'filter[priceValue]': filterPriceValue,
      'filter[costOp]': filterCostOp,
      'filter[costValue]': filterCostValue,
      'filter[stockOp]': filterStockOp,
      'filter[stockValue]': filterStockValue,
      'filter[soldOp]': filterSoldOp,
      'filter[soldValue]': filterSoldValue,
      'filter[ageOp]': filterAgeOp,
      'filter[ageValue]': filterAgeValue,
      'filter[ageUnit]': filterAgeUnit = 'days',
      'filter[type]': filterType = 'all',
      sort = 'name',
      order = 'asc',
      include = ['category', 'brand', 'unit', 'size', 'color'],
    } = query;

    // Ensure page and limit are numbers (fallback if transform didn't work)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.ProductWhereInput = {
      deletedAt: filterStatus === 'all' ? undefined : filterStatus === 'active' ? null : { not: null },
    };

    // Search filter - per-word AND search across fields
    if (search) {
      where.AND = buildPerWordSearch(search, [
        'name',
        'sku',
        'barcode',
      ]);
    }

    // Category filter
    if (filterCategory) {
      where.categoryId = filterCategory;
    }

    // Sub-category filter
    if (filterSubCategory) {
      where.subCategoryId = filterSubCategory;
    }

    // Brand filter
    if (filterBrand) {
      where.brandId = filterBrand;
    }

    // Color / size / unit filters
    if (filterColor) {
      where.colorId = filterColor;
    }
    if (filterSize) {
      where.sizeId = filterSize;
    }
    if (filterUnit) {
      where.unitId = filterUnit;
    }

    // Supplier filter
    if (filterSupplier) {
      where.supplierId = filterSupplier;
    }

    // Price range filter (legacy min/max on selling price)
    if (filterMinPrice !== undefined || filterMaxPrice !== undefined) {
      where.sellingPrice = {};
      if (filterMinPrice !== undefined) {
        where.sellingPrice.gte = filterMinPrice;
      }
      if (filterMaxPrice !== undefined) {
        where.sellingPrice.lte = filterMaxPrice;
      }
    }

    // Selling-price compare filter (harga jual < / > / =)
    if (filterPriceOp !== undefined && filterPriceValue !== undefined) {
      where.sellingPrice = applyCompareOp(where.sellingPrice, filterPriceOp, filterPriceValue);
    }

    // Cost-price compare filter (harga modal < / > / =)
    if (filterCostOp !== undefined && filterCostValue !== undefined) {
      where.costPrice = applyCompareOp(where.costPrice, filterCostOp, filterCostValue);
    }

    // Service/Product type filter
    if (filterType === 'service') {
      where.isService = true;
    } else if (filterType === 'product') {
      where.isService = false;
    }
    // If filterType === 'all', don't filter by isService

    // Aggregation filters (perkiraan jumlah, total terjual, umur) resolve to an
    // id-set first: groupBy cannot filter on the aggregate, so match ids in JS
    // against the same base `where`, then constrain the main query.
    const needsAggregation =
      (filterStockOp !== undefined && filterStockValue !== undefined) ||
      (filterSoldOp !== undefined && filterSoldValue !== undefined) ||
      (filterAgeOp !== undefined && filterAgeValue !== undefined);
    if (needsAggregation) {
      const matchedIds = await this.matchAggregationFilters(where, {
        stockOp: filterStockOp,
        stockValue: filterStockValue,
        soldOp: filterSoldOp,
        soldValue: filterSoldValue,
        ageOp: filterAgeOp,
        ageValue: filterAgeValue,
        ageUnit: filterAgeUnit,
      });
      if (matchedIds.length === 0) {
        return {
          data: [],
          meta: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 },
        };
      }
      where.id = { in: matchedIds };
    }

    // Build include object - optimize by selecting only needed fields
    const includeObj: Prisma.ProductInclude = {};
    if (include.includes('category')) {
      includeObj.category = {
        select: {
          id: true,
          name: true,
          code: true,
        },
      };
    }
    if (include.includes('brand')) {
      includeObj.brand = {
        select: {
          id: true,
          name: true,
        },
      };
    }
        if (include.includes('unit')) {
      includeObj.unit = {
        select: { id: true, name: true },
      };
    }
    if (include.includes('size')) {
      includeObj.size = {
        select: { id: true, name: true },
      };
    }
    if (include.includes('color')) {
      includeObj.color = {
        select: { id: true, name: true },
      };
    }
    if (include.includes('subCategory')) {
      includeObj.subCategory = {
        select: { id: true, code: true, name: true },
      };
    }
    if (include.includes('supplier')) {
      includeObj.supplier = {
        select: { id: true, name: true, customerCode: true },
      };
    }
    if (include.includes('stock')) {
      includeObj.productStocks = {
        select: {
          id: true,
          warehouseId: true,
          branchId: true,
          quantityAvailable: true,
          quantityReserved: true,
          quantityDamaged: true,
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              scope: true,
              outletId: true,
            },
          },
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      };
    }

    // Determine sort field
    let orderBy: Prisma.ProductOrderByWithRelationInput;
    if (sort === 'price') {
      orderBy = { sellingPrice: order };
    } else if (sort === 'createdAt') {
      orderBy = { createdAt: order };
    } else if (sort === 'stock') {
      // For stock sorting, we'll need to use a different approach
      // For now, sort by name
      orderBy = { name: order };
    } else {
      orderBy = { name: order };
    }

    let products, total;
    try {
      [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          skip,
          take: limitNum,
          orderBy,
          include: includeObj,
        }),
        this.prisma.product.count({ where }),
      ]);
    } catch (error) {
      console.error('Database error in products.findAll:', error);
      throw error;
    }

    try {
      const annotations = await this.buildListAnnotations(products.map((p: any) => p.id));
      return {
        data: ProductTransformer.transformMany(products, include.includes('stock'), annotations),
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      };
    } catch (error) {
      console.error('Error transforming products:', error);
      throw error;
    }
  }

  /**
   * List-filter aggregation matching (perkiraan jumlah, total terjual, umur).
   * Resolves each active aggregation filter to a matching product id-set
   * scoped to the same base `where`, then intersects the sets.
   */
  private async matchAggregationFilters(
    baseWhere: Prisma.ProductWhereInput,
    filters: {
      stockOp?: 'gt' | 'lt' | 'eq';
      stockValue?: number;
      soldOp?: 'gt' | 'lt' | 'eq';
      soldValue?: number;
      ageOp?: 'gt' | 'lt' | 'eq';
      ageValue?: number;
      ageUnit?: 'days' | 'months' | 'years';
    },
  ): Promise<string[]> {
    let matched: Set<string> | null = null;
    const intersect = (ids: string[]) => {
      matched = matched === null ? new Set(ids) : new Set(ids.filter((id) => matched!.has(id)));
    };

    // Perkiraan jumlah: total quantityAvailable across all warehouses.
    // Products without any stock row count as 0.
    if (filters.stockOp !== undefined && filters.stockValue !== undefined) {
      const sums = await this.prisma.productStock.groupBy({
        by: ['productId'],
        where: { product: baseWhere },
        _sum: { quantityAvailable: true },
      });
      const sumById = new Map(sums.map((s) => [s.productId, Number(s._sum.quantityAvailable ?? 0)]));
      const candidates = await this.prisma.product.findMany({
        where: baseWhere,
        select: { id: true },
      });
      intersect(
        candidates
          .map((c) => c.id)
          .filter((id) => compareNumbers(sumById.get(id) ?? 0, filters.stockOp!, filters.stockValue!)),
      );
    }

    // Total unit terjual: all-time sum of sales item quantities (never sold = 0)
    if (filters.soldOp !== undefined && filters.soldValue !== undefined) {
      const sums = await this.prisma.salesTransactionItem.groupBy({
        by: ['productId'],
        where: { product: baseWhere },
        _sum: { quantity: true },
      });
      const soldById = new Map(sums.map((s) => [s.productId, Number(s._sum.quantity ?? 0)]));
      const candidates = await this.prisma.product.findMany({
        where: baseWhere,
        select: { id: true },
      });
      intersect(
        candidates
          .map((c) => c.id)
          .filter((id) => compareNumbers(soldById.get(id) ?? 0, filters.soldOp!, filters.soldValue!)),
      );
    }

    // Umur produk: days since last restock (latest IN movement; falls back to
    // product createdAt when the product was never restocked)
    if (filters.ageOp !== undefined && filters.ageValue !== undefined) {
      const days = toDays(filters.ageValue, filters.ageUnit ?? 'days');
      const [candidates, lastIns] = await Promise.all([
        this.prisma.product.findMany({ where: baseWhere, select: { id: true, createdAt: true } }),
        this.prisma.stockMovement.groupBy({
          by: ['productId'],
          where: { movementType: 'IN', product: baseWhere },
          _max: { createdAt: true },
        }),
      ]);
      const lastInById = new Map(lastIns.map((r) => [r.productId, r._max.createdAt]));
      const now = Date.now();
      intersect(
        candidates
          .filter((c) => {
            const last = lastInById.get(c.id) ?? c.createdAt;
            const ageDays = (now - new Date(last).getTime()) / 86400000;
            return compareNumbers(ageDays, filters.ageOp!, days, true);
          })
          .map((c) => c.id),
      );
    }

    return matched === null ? [] : [...matched];
  }

  /**
   * Build per-row list annotations (totalSold, lastRestockAt) for the current
   * page. Rendered by the transformer so the FE table can show them.
   */
  private async buildListAnnotations(
    productIds: string[],
  ): Promise<Map<string, { totalSold: number; lastRestockAt: Date | null }>> {
    const annotations = new Map<string, { totalSold: number; lastRestockAt: Date | null }>();
    if (productIds.length === 0) return annotations;
    const [soldSums, lastIns] = await Promise.all([
      this.prisma.salesTransactionItem.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds } },
        _sum: { quantity: true },
      }),
      this.prisma.stockMovement.groupBy({
        by: ['productId'],
        where: { productId: { in: productIds }, movementType: 'IN' },
        _max: { createdAt: true },
      }),
    ]);
    for (const id of productIds) annotations.set(id, { totalSold: 0, lastRestockAt: null });
    for (const s of soldSums) {
      annotations.get(s.productId)!.totalSold = Number(s._sum.quantity ?? 0);
    }
    for (const r of lastIns) {
      annotations.get(r.productId)!.lastRestockAt = r._max.createdAt;
    }
    return annotations;
  }

  /**
   * Find product by ID with relations
   * @param id - Product ID
   * @param includeStock - Whether to include stock summary
   * @returns Product detail
   */
  async findById(id: string, includeStock: boolean = true): Promise<TransformedProduct> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        subCategory: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        brand: true,
                unit: { select: { id: true, name: true } },
        size: { select: { id: true, name: true } },
        color: { select: { id: true, name: true } },
        supplier: {
          select: {
            id: true,
            name: true,
            customerCode: true,
          },
        },
        productStocks: includeStock
          ? {
              include: {
                warehouse: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    type: true,
                    scope: true,
                    outletId: true,
                  },
                },
                branch: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            }
          : false,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return ProductTransformer.transform(product, includeStock);
  }

  /**
   * Get product sales statistics (total sold, total revenue)
   * Includes both sales transactions and service order usage
   * @param id - Product ID
   * @returns Sales statistics
   */
  async getProductSalesStats(id: string): Promise<{
    totalSold: number;
    totalRevenue: number;
    totalUsedInService: number;
    totalServiceRevenue: number;
    totalReturned: number;
    totalReturnedRevenue: number;
  }> {
    // Get ALL sales items that were ever sold (including those later returned)
    // This includes completed/paid transactions, even if they were later voided/cancelled
    // We need to check the transaction status at the time of sale, not current status
    // Since we can't track historical status, we'll count all completed/paid transactions
    // and separately count void/cancelled transactions
    
    // Get all items from completed/paid transactions (regardless of current status)
    // This represents all items that were ever sold
    const allSoldItems = await this.prisma.salesTransactionItem.findMany({
      where: {
        productId: id,
        transaction: {
          OR: [
            { status: 'completed' },
            { paymentStatus: 'paid' },
          ],
        },
      },
      select: {
        quantity: true,
        unitPrice: true,
        transaction: {
          select: {
            status: true,
          },
        },
      },
    });

    // Get items from void/cancelled transactions (returns)
    const returnedItems = allSoldItems.filter((item) =>
      ['void', 'cancelled'].includes(item.transaction.status),
    );

    // Total sold = all items that were ever sold (from active + returned transactions)
    const totalSold = allSoldItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalRevenue = allSoldItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    );

    // Total returned = items from void/cancelled transactions
    const totalReturned = returnedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalReturnedRevenue = returnedItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    );

    // Get from service orders (parts used)
    const serviceParts = await this.prisma.servicePartsUsed.findMany({
      where: {
        productId: id,
        serviceOrder: {
          status: {
            in: ['completed', 'delivered'], // Only count completed/delivered service orders
          },
        },
      },
      select: {
        quantity: true,
        unitPrice: true,
      },
    });

    const totalUsedInService = serviceParts.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalServiceRevenue = serviceParts.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
      0,
    );

    // Net sold = total sold - total returned
    // This gives us the actual quantity still "sold" (not returned)
    const netSold = totalSold - totalReturned;
    const netRevenue = totalRevenue - totalReturnedRevenue;

    return {
      totalSold: netSold, // Net sold (total ever sold minus returns)
      totalRevenue: netRevenue, // Net revenue (total revenue minus returns)
      totalUsedInService,
      totalServiceRevenue,
      totalReturned,
      totalReturnedRevenue,
    };
  }

  /**
   * Create new product
   * @param createProductDto - Product creation data
   * @param _userId - User ID who created this product (for audit trail)
   * @returns Created product
   */
  async create(createProductDto: CreateProductDto, _userId: string): Promise<TransformedProduct> {
    // Generate SKU if not provided
    let sku = createProductDto.sku;
    if (!sku) {
      sku = await this.generateSKU();
    } else {
      // Check SKU uniqueness
      const existing = await this.prisma.product.findUnique({
        where: { sku },
      });
      if (existing) {
        throw new ConflictException('SKU already exists');
      }
    }

    // Validate barcode if provided
    if (createProductDto.barcode) {
      await this.validateBarcode(createProductDto.barcode);
    }

    // Validate category exists
    const category = await this.prisma.category.findUnique({
      where: { id: createProductDto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Validate brand if provided
    if (createProductDto.brandId) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: createProductDto.brandId },
      });
      if (!brand) {
        throw new NotFoundException('Brand not found');
      }
    }

    // Warning: Selling price < cost price (not error, just warning)
    if (createProductDto.sellingPrice < createProductDto.costPrice) {
      // Log warning but allow creation
      console.warn(
        `Warning: Product ${sku} has selling price (${createProductDto.sellingPrice}) less than cost price (${createProductDto.costPrice})`,
      );
    }

    // IGDERP-195 (PROD-003 data check): minimum price above selling price is
    // invalid data — reject instead of storing it
    if (
      createProductDto.minSellingPrice !== undefined &&
      createProductDto.minSellingPrice !== null &&
      Number(createProductDto.minSellingPrice) > 0 &&
      Number(createProductDto.minSellingPrice) > Number(createProductDto.sellingPrice)
    ) {
      throw new BadRequestException(
        `Harga jual minimum (${createProductDto.minSellingPrice}) tidak boleh lebih besar dari harga jual (${createProductDto.sellingPrice})`,
      );
    }

    // Prepare product data
    const productData: any = {
      sku,
      barcode: createProductDto.barcode || null,
      name: createProductDto.name,
      printedName: createProductDto.printedName || null,
      description: createProductDto.description || null,
      categoryId: createProductDto.categoryId,
      subCategoryId: createProductDto.subCategoryId || null,
      brandId: createProductDto.brandId || null,
      supplierId: createProductDto.supplierId || null,
      costPrice: createProductDto.costPrice,
      sellingPrice: createProductDto.sellingPrice,
      minSellingPrice: createProductDto.minSellingPrice ? new Prisma.Decimal(createProductDto.minSellingPrice) : null,
      unitId: createProductDto.unitId,
      sizeId: createProductDto.sizeId || null,
      colorId: createProductDto.colorId || null,
      lengthCm: createProductDto.lengthCm ? new Prisma.Decimal(createProductDto.lengthCm) : null,
      widthCm: createProductDto.widthCm ? new Prisma.Decimal(createProductDto.widthCm) : null,
      heightCm: createProductDto.heightCm ? new Prisma.Decimal(createProductDto.heightCm) : null,
      weightGrams: createProductDto.weightGrams ? new Prisma.Decimal(createProductDto.weightGrams) : null,
      packageWeightGrams: createProductDto.packageWeightGrams ? new Prisma.Decimal(createProductDto.packageWeightGrams) : null,
      isActive: createProductDto.isActive !== undefined ? createProductDto.isActive : true,
      isService: createProductDto.isService !== undefined ? createProductDto.isService : false,
      trackSerial: createProductDto.trackSerial || false,
      trackBatch: createProductDto.trackBatch || false,
      trackExpiry: createProductDto.trackExpiry || false,
      expiryReturnLimitDays: createProductDto.expiryReturnLimitDays || null,
      grade: (createProductDto as any).grade || null,
      memberPricing: createProductDto.memberPricing || null,
      images: createProductDto.images || null,
    };

    // Create product
    const product = await this.prisma.product.create({
      data: productData,
      include: {
        category: true,
        brand: true,
        productStocks: true,
      },
    });

    return ProductTransformer.transform(product);
  }

  /**
   * Update product
   * @param id - Product ID
   * @param updateProductDto - Product update data
   * @param _userId - User ID who updated this product (for audit trail)
   * @returns Updated product
   */
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    _userId: string,
  ): Promise<TransformedProduct> {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check SKU uniqueness if updating
    if (updateProductDto.sku && updateProductDto.sku !== product.sku) {
      const existing = await this.prisma.product.findUnique({
        where: { sku: updateProductDto.sku },
      });
      if (existing) {
        throw new ConflictException('SKU already exists');
      }
    }

    // Validate barcode if updating
    if (updateProductDto.barcode && updateProductDto.barcode !== product.barcode) {
      await this.validateBarcode(updateProductDto.barcode, id);
    }

    // Validate category if updating
    if (updateProductDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateProductDto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    // Validate brand if updating
    if (updateProductDto.brandId !== undefined) {
      if (updateProductDto.brandId) {
        const brand = await this.prisma.brand.findUnique({
          where: { id: updateProductDto.brandId },
        });
        if (!brand) {
          throw new NotFoundException('Brand not found');
        }
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateProductDto.sku !== undefined) {
      updateData.sku = updateProductDto.sku;
    }
    if (updateProductDto.barcode !== undefined) {
      updateData.barcode = updateProductDto.barcode || null;
    }
    if (updateProductDto.name !== undefined) {
      updateData.name = updateProductDto.name;
    }
    if (updateProductDto.printedName !== undefined) {
      updateData.printedName = updateProductDto.printedName || null;
    }
    if (updateProductDto.description !== undefined) {
      updateData.description = updateProductDto.description || null;
    }
    if (updateProductDto.categoryId !== undefined) {
      updateData.categoryId = updateProductDto.categoryId;
    }
    if (updateProductDto.subCategoryId !== undefined) {
      updateData.subCategoryId = updateProductDto.subCategoryId || null;
    }
    if (updateProductDto.brandId !== undefined) {
      updateData.brandId = updateProductDto.brandId || null;
    }
    if (updateProductDto.supplierId !== undefined) {
      updateData.supplierId = updateProductDto.supplierId || null;
    }
    if (updateProductDto.costPrice !== undefined) {
      updateData.costPrice = updateProductDto.costPrice;
    }
    if (updateProductDto.sellingPrice !== undefined) {
      updateData.sellingPrice = updateProductDto.sellingPrice;
    }
    if (updateProductDto.minSellingPrice !== undefined) {
      updateData.minSellingPrice = updateProductDto.minSellingPrice ? new Prisma.Decimal(updateProductDto.minSellingPrice) : null;
    }
    // IGDERP-195 (PROD-003 data check): merged minimum must not exceed selling
    {
      const effSelling =
        updateProductDto.sellingPrice !== undefined
          ? Number(updateProductDto.sellingPrice)
          : Number(product.sellingPrice);
      const effMin =
        updateProductDto.minSellingPrice !== undefined
          ? Number(updateProductDto.minSellingPrice || 0)
          : Number(product.minSellingPrice || 0);
      if (effMin > 0 && effMin > effSelling) {
        throw new BadRequestException(
          `Harga jual minimum (${effMin}) tidak boleh lebih besar dari harga jual (${effSelling})`,
        );
      }
    }
    if (updateProductDto.unitId !== undefined) {
      updateData.unitId = updateProductDto.unitId;
    }
    if (updateProductDto.trackSerial !== undefined) {
      updateData.trackSerial = updateProductDto.trackSerial;
    }
    if (updateProductDto.trackBatch !== undefined) {
      updateData.trackBatch = updateProductDto.trackBatch;
    }
    if (updateProductDto.memberPricing !== undefined) {
      updateData.memberPricing = updateProductDto.memberPricing || null;
    }
    if (updateProductDto.images !== undefined) {
      updateData.images = updateProductDto.images || null;
    }
    if (updateProductDto.sizeId !== undefined) {
      updateData.sizeId = updateProductDto.sizeId || null;
    }
    if (updateProductDto.colorId !== undefined) {
      updateData.colorId = updateProductDto.colorId || null;
    }
    if (updateProductDto.lengthCm !== undefined) {
      updateData.lengthCm = updateProductDto.lengthCm ? new Prisma.Decimal(updateProductDto.lengthCm) : null;
    }
    if (updateProductDto.widthCm !== undefined) {
      updateData.widthCm = updateProductDto.widthCm ? new Prisma.Decimal(updateProductDto.widthCm) : null;
    }
    if (updateProductDto.heightCm !== undefined) {
      updateData.heightCm = updateProductDto.heightCm ? new Prisma.Decimal(updateProductDto.heightCm) : null;
    }
    if (updateProductDto.weightGrams !== undefined) {
      updateData.weightGrams = updateProductDto.weightGrams ? new Prisma.Decimal(updateProductDto.weightGrams) : null;
    }
    if (updateProductDto.packageWeightGrams !== undefined) {
      updateData.packageWeightGrams = updateProductDto.packageWeightGrams ? new Prisma.Decimal(updateProductDto.packageWeightGrams) : null;
    }
    if (updateProductDto.isActive !== undefined) {
      updateData.isActive = updateProductDto.isActive;
    }
    if (updateProductDto.isService !== undefined) {
      updateData.isService = updateProductDto.isService;
    }
    if (updateProductDto.trackExpiry !== undefined) {
      updateData.trackExpiry = updateProductDto.trackExpiry;
    }
    if (updateProductDto.expiryReturnLimitDays !== undefined) {
      updateData.expiryReturnLimitDays = updateProductDto.expiryReturnLimitDays || null;
    }
    if ((updateProductDto as any).grade !== undefined) {
      updateData.grade = (updateProductDto as any).grade || null;
    }

    // Update product
    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: true,
        brand: true,
        productStocks: {
          include: {
            warehouse: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                scope: true,
                outletId: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    return ProductTransformer.transform(updatedProduct, true);
  }

  /**
   * Soft delete product
   * @param id - Product ID
   * @param _userId - User ID who deleted this product (for audit trail)
   */
  async softDelete(id: string, _userId: string): Promise<void> {
    // Check if product can be deleted
    await this.checkStockBeforeDelete(id);

    // Soft delete
    await this.prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  /**
   * Duplicate product with new SKU
   * @param id - Product ID to duplicate
   * @param _userId - User ID who duplicated this product (for audit trail)
   * @returns Duplicated product
   */
  async duplicate(id: string, _userId: string): Promise<TransformedProduct> {
    const originalProduct = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
      },
    });

    if (!originalProduct) {
      throw new NotFoundException('Product not found');
    }

    // Generate new SKU
    const newSku = await this.generateSKU();

    // Prepare duplicate data
    const duplicateData: any = {
      sku: newSku,
      barcode: null, // Clear barcode (must be unique)
      name: `${originalProduct.name} (Copy)`,
      description: originalProduct.description,
      categoryId: originalProduct.categoryId,
      brandId: originalProduct.brandId,
      costPrice: originalProduct.costPrice,
      sellingPrice: originalProduct.sellingPrice,
      unitId: originalProduct.unitId,
      isActive: true,
      trackSerial: originalProduct.trackSerial,
      trackBatch: originalProduct.trackBatch,
      memberPricing: originalProduct.memberPricing,
      images: originalProduct.images,
    };

    // Copy optional fields
    // Note: size, color, weightGrams, isService, discountPercentage are not in Prisma Product schema
    // These fields might be stored in memberPricing JSON or calculated from category
    // They are kept in DTO for future use but not saved to Product table directly

    // Create duplicated product
    const duplicatedProduct = await this.prisma.product.create({
      data: duplicateData,
      include: {
        category: true,
        brand: true,
        productStocks: true,
      },
    });

    return ProductTransformer.transform(duplicatedProduct);
  }

  /**
   * Get stock across all branches
   * @param id - Product ID
   * @returns Stock summary
   */
  async getStock(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.calculateStockSummary(id);
  }

  /**
   * Get product activity history (stock movements, sales, service usage, etc.)
   * @param productId - Product ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Activity history with pagination
   */
  async getActivityHistory(productId: string, page: number = 1, limit: number = 3) {
    const skip = (page - 1) * limit;

    // Get stock movements
    const stockMovements = await this.prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        productId: true,
        movementType: true,
        referenceType: true,
        referenceId: true,
        quantityChange: true,
        quantityBefore: true,
        quantityAfter: true,
        notes: true,
        createdAt: true,
        createdBy: true,
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Get sales transactions
    const salesItems = await this.prisma.salesTransactionItem.findMany({
      where: { productId },
      include: {
        transaction: {
          select: {
            id: true,
            transactionNumber: true,
            status: true,
            createdAt: true,
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get service parts usage
    const serviceParts = await this.prisma.servicePartsUsed.findMany({
      where: { productId },
      include: {
        serviceOrder: {
          select: {
            id: true,
            serviceNumber: true,
            status: true,
            createdAt: true,
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Combine all activities
    const allActivities: any[] = [];

    // Add stock movements
    stockMovements.forEach((movement) => {
      const qtyChange = movement.quantityChange.toNumber();
      let activityType = '';
      let description = '';

      switch (movement.movementType) {
        case 'IN':
          activityType = 'STOCK_IN';
          description = `Penambahan stok: +${Math.abs(qtyChange)} unit`;
          break;
        case 'OUT':
          activityType = 'STOCK_OUT';
          description = `Penggunaan stok: -${Math.abs(qtyChange)} unit`;
          break;
        case 'TRANSFER':
          activityType = 'STOCK_TRANSFER';
          description = `Pemindahan stok: ${qtyChange > 0 ? '+' : ''}${qtyChange} unit`;
          break;
        case 'ADJUSTMENT':
          activityType = 'STOCK_ADJUSTMENT';
          description = `Penyesuaian stok: ${qtyChange > 0 ? '+' : ''}${qtyChange} unit`;
          break;
        default:
          activityType = 'STOCK_CHANGE';
          description = `Perubahan stok: ${qtyChange > 0 ? '+' : ''}${qtyChange} unit`;
      }

      if (movement.referenceType) {
        description += ` (${movement.referenceType})`;
      }

      allActivities.push({
        id: movement.id,
        type: activityType,
        description,
        branch: movement.branch,
        quantityBefore: movement.quantityBefore.toNumber(),
        quantityAfter: movement.quantityAfter.toNumber(),
        quantityChange: qtyChange,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        notes: movement.notes,
        createdAt: movement.createdAt,
        createdBy: movement.createdBy,
      });
    });

    // Add sales transactions - get stock movement data for quantityBefore/After
    for (const item of salesItems) {
      const qty = item.quantity.toNumber();
      const price = item.unitPrice.toNumber();
      const status = item.transaction.status;
      
      // Find related stock movement for this transaction
      const relatedMovement = stockMovements.find(
        (m) => m.referenceType === 'SALE' && m.referenceId === item.transaction.id
      );
      
      allActivities.push({
        id: `sales-${item.id}`,
        type: status === 'completed' ? 'SALES' : status === 'void' || status === 'cancelled' ? 'SALES_RETURN' : 'SALES_PENDING',
        description: status === 'completed' 
          ? `Terjual: ${qty} unit (${item.transaction.transactionNumber})`
          : status === 'void' || status === 'cancelled'
          ? `Retur penjualan: ${qty} unit (${item.transaction.transactionNumber})`
          : `Penjualan pending: ${qty} unit (${item.transaction.transactionNumber})`,
        branch: item.transaction.branch,
        quantityBefore: relatedMovement ? relatedMovement.quantityBefore.toNumber() : undefined,
        quantityAfter: relatedMovement ? relatedMovement.quantityAfter.toNumber() : undefined,
        quantityChange: status === 'void' || status === 'cancelled' ? qty : -qty,
        referenceType: 'SALES_TRANSACTION',
        referenceId: item.transaction.id,
        notes: `Total: ${this.formatCurrency(qty * price)}`,
        createdAt: item.transaction.createdAt,
        createdBy: null,
      });
    }

    // Add service parts usage - get stock movement data for quantityBefore/After
    for (const part of serviceParts) {
      const qty = part.quantity.toNumber();
      const price = part.unitPrice.toNumber();
      const status = part.serviceOrder.status;
      
      // Find related stock movement for this service order
      // Service parts create stock movements with referenceType='SERVICE' and notes containing serviceNumber
      const relatedMovement = stockMovements.find(
        (m) => m.referenceType === 'SERVICE' && 
        m.productId === productId &&
        m.notes?.includes(part.serviceOrder.serviceNumber)
      );
      
      allActivities.push({
        id: `service-${part.id}`,
        type: status === 'completed' || status === 'delivered' ? 'SERVICE_USAGE' : 'SERVICE_USAGE_PENDING',
        description: `Digunakan untuk service: ${qty} unit (${part.serviceOrder.serviceNumber})`,
        branch: part.serviceOrder.branch,
        quantityBefore: relatedMovement ? relatedMovement.quantityBefore.toNumber() : undefined,
        quantityAfter: relatedMovement ? relatedMovement.quantityAfter.toNumber() : undefined,
        quantityChange: -qty,
        referenceType: 'SERVICE_ORDER',
        referenceId: part.serviceOrder.id,
        notes: `Total: ${this.formatCurrency(qty * price)}`,
        createdAt: part.serviceOrder.createdAt,
        createdBy: null,
      });
    }

    // Sort by date (newest first) and paginate
    allActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = allActivities.length;
    const paginatedActivities = allActivities.slice(skip, skip + limit);

    return {
      data: paginatedActivities,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Helper function for currency formatting
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Get overall product statistics from entire database
   * @returns Product statistics (total, stock value, low stock count, active count)
   */
  async getStatistics() {
    // Get all products (not paginated)
    const allProducts = await this.prisma.product.findMany({
      where: {
        deletedAt: null, // Only active products
      },
      include: {
        productStocks: {
          select: {
            quantityAvailable: true,
            quantityReserved: true,
            minStock: true,
          },
        },
      },
    });

    // Calculate statistics
    const totalProducts = allProducts.length;
    let totalStockValue = 0;
    let lowStockCount = 0;
    let activeCount = 0;

    for (const product of allProducts) {
      // Calculate total stock for this product
      const totalStock = product.productStocks.reduce(
        (sum, stock) => sum + stock.quantityAvailable.toNumber() - stock.quantityReserved.toNumber(),
        0,
      );

      // Add to total stock value (using cost price)
      totalStockValue += product.costPrice.toNumber() * totalStock;

      // Check if low stock (minStock is in ProductStock, use the minimum minStock across all branches)
      const minStocks = product.productStocks
        .map((stock) => stock.minStock?.toNumber() || 0)
        .filter((min) => min > 0);
      const minStock = minStocks.length > 0 ? Math.min(...minStocks) : 0;
      
      if (totalStock < minStock) {
        lowStockCount++;
      }

      // Count active products
      if (product.isActive) {
        activeCount++;
      }
    }

    return {
      total: totalProducts,
      totalStockValue,
      lowStockCount,
      activeCount,
    };
  }

  /**
   * Export products to CSV
   * @param _query - List products query parameters (not used, exports all products)
   * @returns CSV string
   */
  async exportToCSV(_query: ListProductsDto): Promise<string> {
    // Get all products (no pagination for export) with all relations
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        category: true,
        subCategory: true,
        brand: true,
                unit: { select: { id: true, name: true } },
        size: { select: { id: true, name: true } },
        color: { select: { id: true, name: true } },
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
        productStocks: {
          include: {
            warehouse: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                scope: true,
                outletId: true,
              },
            },
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });
    const data = products;

    // CSV Headers - sesuai dengan example_import_produk.csv
    const headers = [
      'Barcode',
      'Kode Ref',
      'Nama Produk',
      'Nama Tercetak',
      'Satuan',
      'Kategori',
      'Sub Kategori',
      'Merek',
      'Ukuran',
      'Warna',
      'Panjang(cm)',
      'Lebar(cm)',
      'Tinggi(cm)',
      'Berat Barang (gram)',
      'Berat Paket (gram)',
      'Harga Jual',
      'Diskon',
      'Harga Diskon',
      'Harga Jual Minimum',
      'Jasa(Y/N)',
      'SN(1)/Bahan(2)',
      'Menggunakan No Batch(Y/N)',
      'Menggunakan Tgl Kadaluarsa(Y/N)',
      'Batas Retur Kadaluarsa',
      'Harga Modal',
      'Supplier',
      'Stok IGD Jember - Spare Part - IGD Group MWH',
      'Stok IGD Kalisat - Spare Part - IGD Kalisat - Spare Part',
      'Stok IGD Jember - Spare Part - IGD Jember - Spare Part',
      'Stok IGD Kalisat - Service - IGD Kalisat - Service',
      'IGD Jember - Spare Part - Harga Outlet',
      'IGD Jember - Spare Part - Diskon',
      'IGD Kalisat - Service - Harga Outlet',
      'IGD Kalisat - Service - Diskon',
      'IGD Kalisat - Spare Part - Harga Outlet',
      'IGD Kalisat - Spare Part - Diskon',
      'Platinum',
      'Gold',
      'Silver',
      'User',
      'Qty 1',
      'Harga Qty 1',
      'Qty 2',
      'Harga Qty 2',
      'Qty 3',
      'Harga Qty 3',
      'Qty 4',
      'Harga Qty 4',
      'Qty 5',
      'Harga Qty 5',
      'Qty 6',
      'Harga Qty 6',
      'Qty 7',
      'Harga Qty 7',
      'Qty 8',
      'Harga Qty 8',
      'Qty 9',
      'Harga Qty 9',
      'Qty 10',
      'Harga Qty 10',
    ];

    // Build CSV content (semicolon-separated)
    const csvLines = [headers.join(';')];

    // Get all branches for stock mapping (if needed in future)
    // const branches = await this.prisma.branch.findMany();

    for (const product of data) {
      // Get member pricing
      const memberPricing = (product.memberPricing as any) || {};
      const platinum = memberPricing.platinum?.discount || '';
      const gold = memberPricing.gold?.discount || '';
      const silver = memberPricing.silver?.discount || '';

      // Get stock per branch
      const branchStocks: Record<string, number> = {};
      product.productStocks.forEach((stock) => {
        const branchName = stock.branch?.name || stock.warehouse?.name || 'Gudang Pusat';
        branchStocks[branchName] = stock.quantityAvailable.toNumber() - stock.quantityReserved.toNumber();
      });

      // Get quantity pricing (from memberPricing)
      const qtyPricing: Record<number, { qty: string; price: string }> = {};
      for (let i = 1; i <= 10; i++) {
        const qtyKey = `qty${i}`;
        if (memberPricing[qtyKey]) {
          qtyPricing[i] = {
            qty: memberPricing[qtyKey].qty || '',
            price: memberPricing[qtyKey].price || '',
          };
        } else {
          qtyPricing[i] = { qty: '', price: '' };
        }
      }

      // Calculate effective price (selling price - discount)
      const discountPercent = (product as any).discountPercentage || 0;
      const effectivePrice = product.sellingPrice.toNumber() * (1 - discountPercent / 100);

      const row = [
        this.escapeCSV(product.barcode || '', ';'),
        this.escapeCSV(product.sku || '', ';'),
        this.escapeCSV(product.name || '', ';'),
        this.escapeCSV(product.printedName || product.name || '', ';'),
        product.unitId || '',
        product.category?.name || '',
        product.subCategory?.name || '',
        product.brand?.name || '',
        product.sizeId || '',
        product.colorId || '',
        product.lengthCm ? String(product.lengthCm.toNumber()) : '',
        product.widthCm ? String(product.widthCm.toNumber()) : '',
        product.heightCm ? String(product.heightCm.toNumber()) : '',
        product.weightGrams ? String(product.weightGrams.toNumber()) : '',
        product.packageWeightGrams ? String(product.packageWeightGrams.toNumber()) : '',
        product.sellingPrice ? String(product.sellingPrice.toNumber()) : '',
        discountPercent ? String(discountPercent) : '0',
        String(effectivePrice),
        product.minSellingPrice ? String(product.minSellingPrice.toNumber()) : '',
        product.isService ? 'Y' : 'N',
        product.trackSerial ? '1' : '2',
        product.trackBatch ? 'Y' : 'N',
        product.trackExpiry ? 'Y' : 'N',
        product.expiryReturnLimitDays ? String(product.expiryReturnLimitDays) : '0',
        product.costPrice ? String(product.costPrice.toNumber()) : '',
        product.supplier?.name || '',
        String(branchStocks['IGD Jember - Spare Part - IGD Group MWH'] || 0),
        String(branchStocks['IGD Kalisat - Spare Part - IGD Kalisat - Spare Part'] || 0),
        String(branchStocks['IGD Jember - Spare Part - IGD Jember - Spare Part'] || 0),
        String(branchStocks['IGD Kalisat - Service - IGD Kalisat - Service'] || 0),
        '', // IGD Jember - Spare Part - Harga Outlet (not in schema)
        '', // IGD Jember - Spare Part - Diskon (not in schema)
        '', // IGD Kalisat - Service - Harga Outlet (not in schema)
        '', // IGD Kalisat - Service - Diskon (not in schema)
        '', // IGD Kalisat - Spare Part - Harga Outlet (not in schema)
        '', // IGD Kalisat - Spare Part - Diskon (not in schema)
        platinum ? String(platinum) : '',
        gold ? String(gold) : '',
        silver ? String(silver) : '',
        '', // User (not in schema)
        qtyPricing[1].qty, qtyPricing[1].price,
        qtyPricing[2].qty, qtyPricing[2].price,
        qtyPricing[3].qty, qtyPricing[3].price,
        qtyPricing[4].qty, qtyPricing[4].price,
        qtyPricing[5].qty, qtyPricing[5].price,
        qtyPricing[6].qty, qtyPricing[6].price,
        qtyPricing[7].qty, qtyPricing[7].price,
        qtyPricing[8].qty, qtyPricing[8].price,
        qtyPricing[9].qty, qtyPricing[9].price,
        qtyPricing[10].qty, qtyPricing[10].price,
      ];
      csvLines.push(row.join(';'));
    }

    return csvLines.join('\n');
  }

  /**
   * Import products from CSV
   * @param csvContent - CSV file content
   * @param userId - User ID performing the import
   */
  async importFromCSV(csvContent: string, userId: string): Promise<{
    success: number;
    updated: number;
    created: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    const lines = csvContent.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      throw new BadRequestException('CSV file is empty or invalid');
    }

    // Detect delimiter (semicolon or comma)
    const firstLine = lines[0];
    const isSemicolonDelimited = firstLine.includes(';') && firstLine.split(';').length > firstLine.split(',').length;
    const delimiter = isSemicolonDelimited ? ';' : ',';

    // Parse header
    const headers = this.parseCSVLine(lines[0], delimiter);
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase().trim()] = i;
    });

    // Validate required headers (name in any language)
    const hasName = headerMap['nama produk'] !== undefined || headerMap['nama_produk'] !== undefined || headerMap['name'] !== undefined;
    
    if (!hasName) {
      throw new BadRequestException('Required column "Nama Produk" or "Name" not found in CSV');
    }

    const results = {
      success: 0,
      updated: 0,
      created: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    // Get all categories and brands for lookup
    const categories = await this.prisma.category.findMany();
    const brands = await this.prisma.brand.findMany();
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
    const brandMap = new Map(brands.map(b => [b.name.toLowerCase(), b.id]));
    const allUnits = await this.prisma.unit.findMany({ where: { isActive: true } });
    const allSizes = await this.prisma.size.findMany({ where: { isActive: true } });
    const allColors = await this.prisma.color.findMany({ where: { isActive: true } });
    const unitMap = new Map(allUnits.map(u => [u.name.toLowerCase(), u.id]));
    const sizeMap = new Map(allSizes.map(s => [s.name.toLowerCase(), s.id]));
    const colorMap = new Map(allColors.map(c => [c.name.toLowerCase(), c.id]));

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseCSVLine(line, delimiter);
        const rowData: any = {};
        headers.forEach((header, index) => {
          const value = values[index]?.trim() || '';
          rowData[header.toLowerCase().trim()] = value;
        });

        // Map CSV columns to DTO - support both Indonesian and English column names
        const productName = rowData['nama produk'] || rowData['nama_produk'] || rowData['name'] || '';
        if (!productName) {
          throw new BadRequestException('Nama Produk wajib diisi');
        }

        // Find or create category
        const categoryName = rowData['kategori'] || rowData['category'] || '';
        let categoryId: string | undefined;
        if (categoryName) {
          const categoryLower = categoryName.toLowerCase();
          categoryId = categoryMap.get(categoryLower);
          if (!categoryId) {
            // Try to find by partial match
            const foundCategory = categories.find(c => c.name.toLowerCase().includes(categoryLower) || categoryLower.includes(c.name.toLowerCase()));
            if (foundCategory) {
              categoryId = foundCategory.id;
            } else {
              // Auto-create category if not found
              const catCode = await this.generateCategoryCode(categoryName.trim());
              const newCat = await this.prisma.category.create({
                data: { name: categoryName.trim(), code: catCode },
              });
              categoryId = newCat.id;
              categories.push(newCat);
              categoryMap.set(categoryLower, newCat.id);
            }
          }
        }

        // Find or create brand (optional)
        let brandId: string | undefined;
        const brandName = rowData['merek'] || rowData['brand'] || '';
        if (brandName) {
          const brandLower = brandName.toLowerCase();
          brandId = brandMap.get(brandLower);
          if (!brandId) {
            const foundBrand = brands.find(b => b.name.toLowerCase().includes(brandLower) || brandLower.includes(b.name.toLowerCase()));
            if (foundBrand) {
              brandId = foundBrand.id;
            } else {
              // Auto-create brand if not found
              const brandCode = await this.generateBrandCode(brandName.trim());
              const newBrand = await this.prisma.brand.create({
                data: { name: brandName.trim(), code: brandCode },
              });
              brandId = newBrand.id;
              brands.push(newBrand);
              brandMap.set(brandLower, newBrand.id);
            }
          }
        }

        // Find or create sub category (optional)
        let subCategoryId: string | undefined;
        const subCategoryName = rowData['sub kategori'] || rowData['sub_kategori'] || rowData['subcategory'] || '';
        if (subCategoryName && categoryId) {
          const subCategoryLower = subCategoryName.toLowerCase();
          const foundSubCategory = categories.find(c => 
            c.parentCategoryId === categoryId && 
            (c.name.toLowerCase() === subCategoryLower || c.name.toLowerCase().includes(subCategoryLower))
          );
          if (foundSubCategory) {
            subCategoryId = foundSubCategory.id;
          } else {
            // Auto-create sub category under the parent
            const subCatCode = await this.generateCategoryCode(subCategoryName.trim());
            const newSubCat = await this.prisma.category.create({
              data: { name: subCategoryName.trim(), code: subCatCode, parentCategoryId: categoryId },
            });
            subCategoryId = newSubCat.id;
            categories.push(newSubCat);
          }
        }

        // Find supplier (optional) - lookup by name in customers with customerType='wholesale'
        let supplierId: string | undefined;
        const supplierName = rowData['supplier'] || '';
        if (supplierName) {
          const supplier = await this.prisma.customer.findFirst({
            where: {
              name: { equals: supplierName, mode: 'insensitive' },
              customerType: 'wholesale',
              deletedAt: null,
            },
          });
          if (supplier) {
            supplierId = supplier.id;
          }
        }

        const productData: any = {
          name: productName,
          printedName: rowData['nama tercetak'] || rowData['nama_tercetak'] || rowData['printed_name'] || productName,
          sku: rowData['kode ref'] || rowData['kode_ref'] || rowData['sku'] || undefined,
          barcode: rowData['barcode'] || undefined,
          categoryId: categoryId!,
          subCategoryId: subCategoryId || undefined,
          brandId: brandId || undefined,
          supplierId: supplierId || undefined,
          unitId: unitMap.get((rowData['satuan'] || rowData['unit'] || '').toLowerCase()) || undefined,
          sizeId: sizeMap.get((rowData['ukuran'] || rowData['size'] || '').toLowerCase()) || undefined,
          colorId: colorMap.get((rowData['warna'] || rowData['color'] || '').toLowerCase()) || undefined,
          lengthCm: rowData['panjang(cm)'] || rowData['panjang'] || rowData['length_cm'] ? parseFloat(rowData['panjang(cm)'] || rowData['panjang'] || rowData['length_cm']) || undefined : undefined,
          widthCm: rowData['lebar(cm)'] || rowData['lebar'] || rowData['width_cm'] ? parseFloat(rowData['lebar(cm)'] || rowData['lebar'] || rowData['width_cm']) || undefined : undefined,
          heightCm: rowData['tinggi(cm)'] || rowData['tinggi'] || rowData['height_cm'] ? parseFloat(rowData['tinggi(cm)'] || rowData['tinggi'] || rowData['height_cm']) || undefined : undefined,
          weightGrams: rowData['berat barang (gram)'] || rowData['berat_barang'] || rowData['weight_grams'] ? parseFloat(rowData['berat barang (gram)'] || rowData['berat_barang'] || rowData['weight_grams']) || undefined : undefined,
          packageWeightGrams: rowData['berat paket (gram)'] || rowData['berat_paket'] || rowData['package_weight_grams'] ? parseFloat(rowData['berat paket (gram)'] || rowData['berat_paket'] || rowData['package_weight_grams']) || undefined : undefined,
          costPrice: rowData['harga modal'] || rowData['harga_modal'] || rowData['cost_price'] ? parseFloat(rowData['harga modal'] || rowData['harga_modal'] || rowData['cost_price']) || 0 : 0,
          sellingPrice: rowData['harga jual'] || rowData['harga_jual'] || rowData['selling_price'] ? parseFloat(rowData['harga jual'] || rowData['harga_jual'] || rowData['selling_price']) || 0 : 0,
          minSellingPrice: rowData['harga jual minimum'] || rowData['harga_jual_minimum'] || rowData['min_selling_price'] ? parseFloat(rowData['harga jual minimum'] || rowData['harga_jual_minimum'] || rowData['min_selling_price']) || undefined : undefined,
          discountPercentage: rowData['diskon'] || rowData['discount'] ? parseFloat(rowData['diskon'] || rowData['discount']) || 0 : 0,
          description: rowData['deskripsi'] || rowData['description'] || undefined,
          isActive: true, // Default to active
          isService: rowData['jasa(y/n)'] || rowData['jasa'] ? (rowData['jasa(y/n)'] || rowData['jasa']).toUpperCase() === 'Y' : false,
          trackSerial: rowData['sn(1)/bahan(2)'] || rowData['sn'] ? (rowData['sn(1)/bahan(2)'] || rowData['sn']) === '1' : false,
          trackBatch: rowData['menggunakan no batch(y/n)'] || rowData['batch'] ? (rowData['menggunakan no batch(y/n)'] || rowData['batch']).toUpperCase() === 'Y' : false,
          trackExpiry: rowData['menggunakan tgl kadaluarsa(y/n)'] || rowData['expiry'] ? (rowData['menggunakan tgl kadaluarsa(y/n)'] || rowData['expiry']).toUpperCase() === 'Y' : false,
          expiryReturnLimitDays: rowData['batas retur kadaluarsa'] || rowData['expiry_return_limit'] ? parseInt(rowData['batas retur kadaluarsa'] || rowData['expiry_return_limit']) || undefined : undefined,
        };

        // Validate required fields
        if (!productData.categoryId) {
          throw new BadRequestException('Kategori wajib diisi');
        }
        if (!productData.costPrice || productData.costPrice <= 0) {
          throw new BadRequestException('Harga Modal wajib diisi dan harus lebih dari 0');
        }
        if (!productData.sellingPrice || productData.sellingPrice <= 0) {
          throw new BadRequestException('Harga Jual wajib diisi dan harus lebih dari 0');
        }

        // Check for duplicate - by SKU or barcode or name
        let existing = null;
        if (productData.sku) {
          existing = await this.prisma.product.findFirst({
            where: {
              sku: productData.sku,
              deletedAt: null,
            },
          });
        }
        if (!existing && productData.barcode) {
          existing = await this.prisma.product.findFirst({
            where: {
              barcode: productData.barcode,
              deletedAt: null,
            },
          });
        }
        if (!existing) {
          existing = await this.prisma.product.findFirst({
            where: {
              name: { equals: productData.name, mode: 'insensitive' },
              deletedAt: null,
            },
          });
        }

        if (existing) {
          // Update existing product
          await this.update(existing.id, productData, userId);
          results.updated++;
          results.success++;
        } else {
          // Create new product
          await this.create(productData, userId);
          results.created++;
          results.success++;
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Build the product XLSX import template (29 user columns, headers only).
   */
  async buildProductImportTemplate(): Promise<Buffer> {
    const { buildProductImportTemplate } = require('../../shared/utils/product-import-template');
    return buildProductImportTemplate();
  }

  /**
   * Preview a product XLSX import — READ-ONLY, no writes.
   * Resolves names to ids; unknown category/brand names are flagged for
   * auto-create at confirm time, unknown unit/size/color are row errors.
   */
  async previewProductImport(buffer: Buffer): Promise<{
    rows: any[];
    validCount: number;
    errorCount: number;
  }> {
    const {
      parseProductImportBuffer,
      parseProductImportNumber,
      PRODUCT_STOCK_LABELS,
    } = require('../../shared/utils/product-import-template');
    const rawRows = await parseProductImportBuffer(buffer);

    const [categories, brands, units, sizes, colors, warehouses, suppliers] = await Promise.all([
      this.prisma.category.findMany(),
      this.prisma.brand.findMany(),
      this.prisma.unit.findMany({ where: { isActive: true } }),
      this.prisma.size.findMany({ where: { isActive: true } }),
      this.prisma.color.findMany({ where: { isActive: true } }),
      this.prisma.warehouse.findMany(),
      this.prisma.customer.findMany({ where: { customerType: 'wholesale', deletedAt: null } }),
    ]);
    const byName = (list: any[]) => new Map(list.map((e) => [String(e.name).toLowerCase(), e]));
    const categoryMap = byName(categories);
    const brandMap = byName(brands);
    const unitMap = byName(units);
    const sizeMap = byName(sizes);
    const colorMap = byName(colors);
    const warehouseMap = byName(warehouses);
    const supplierMap = byName(suppliers);

    const rows: any[] = [];
    for (const raw of rawRows) {
      const errors: string[] = [];
      const name = raw.name?.trim() || '';
      if (!name) errors.push('Item (nama produk) wajib diisi');

      const sellingPrice = parseProductImportNumber(raw.sellingPriceRaw);
      if (sellingPrice === null || sellingPrice <= 0) errors.push('Harga Reguler wajib diisi dan harus lebih dari 0');
      const costPrice = parseProductImportNumber(raw.costPriceRaw);
      if (costPrice === null || costPrice <= 0) errors.push('Harga Modal wajib diisi dan harus lebih dari 0');

      // Category — resolve or auto-create at confirm
      let categoryId: string | null = null;
      let categoryName: string | undefined;
      let willCreateCategory = false;
      if (raw.category) {
        const found = categoryMap.get(raw.category.toLowerCase());
        if (found) categoryId = found.id;
        else {
          categoryName = raw.category.trim();
          willCreateCategory = true;
        }
      } else {
        errors.push('Kategori wajib diisi');
      }

      // Brand — resolve or auto-create at confirm (optional)
      let brandId: string | null = null;
      let brandName: string | undefined;
      let willCreateBrand = false;
      if (raw.brand) {
        const found = brandMap.get(raw.brand.toLowerCase());
        if (found) brandId = found.id;
        else {
          brandName = raw.brand.trim();
          willCreateBrand = true;
        }
      }

      // Unit / size / color — error if not found
      let unitId: string | undefined;
      let unitName: string | undefined;
      if (raw.unit) {
        const found = unitMap.get(raw.unit.toLowerCase());
        if (found) {
          unitId = found.id;
          unitName = found.name;
        } else errors.push(`Satuan '${raw.unit}' tidak ditemukan`);
      }
      let sizeId: string | undefined;
      let sizeName: string | undefined;
      if (raw.size) {
        const found = sizeMap.get(raw.size.toLowerCase());
        if (found) {
          sizeId = found.id;
          sizeName = found.name;
        } else errors.push(`Ukuran '${raw.size}' tidak ditemukan`);
      }
      let colorId: string | undefined;
      let colorName: string | undefined;
      if (raw.color) {
        const found = colorMap.get(raw.color.toLowerCase());
        if (found) {
          colorId = found.id;
          colorName = found.name;
        } else errors.push(`Warna '${raw.color}' tidak ditemukan`);
      }

      // Supplier — optional, null when not found (no error)
      let supplierId: string | null = null;
      let supplierName: string | undefined;
      if (raw.supplier) {
        const found = supplierMap.get(raw.supplier.toLowerCase());
        if (found) {
          supplierId = found.id;
          supplierName = found.name;
        }
      }

      // Member-pricing discounts (numeric or empty)
      const memberPricing: Record<string, { discount: number }> = {};
      for (const [rawKey, tier] of [
        [raw.platinumRaw, 'platinum'],
        [raw.goldRaw, 'gold'],
        [raw.silverRaw, 'silver'],
        [raw.userRaw, 'user'],
      ] as const) {
        const n = parseProductImportNumber(rawKey);
        if (n !== null) memberPricing[tier] = { discount: n };
        else if (rawKey !== '' && rawKey !== null && rawKey !== undefined) {
          errors.push(`Diskon ${tier} harus berupa angka`);
        }
      }

      // Per-warehouse opening stocks — unknown warehouse names skipped
      const stocks: Array<{ warehouseId: string; warehouseName: string; quantity: number }> = [];
      for (const label of PRODUCT_STOCK_LABELS as string[]) {
        const wh = warehouseMap.get(label.toLowerCase());
        if (!wh) continue;
        const qtyRaw = raw.stocksRaw[label];
        if (qtyRaw === '' || qtyRaw === null || qtyRaw === undefined) continue;
        const qty = parseProductImportNumber(qtyRaw);
        if (qty === null || qty < 0) {
          errors.push(`Stok '${label}' harus berupa angka >= 0`);
          continue;
        }
        if (qty > 0) stocks.push({ warehouseId: wh.id, warehouseName: wh.name, quantity: qty });
      }

      // Identity check (read-only): barcode first, then name insensitive
      let action: 'create' | 'update' = 'create';
      if (raw.barcode) {
        const byBarcode = await this.prisma.product.findFirst({
          where: { barcode: raw.barcode, deletedAt: null },
        });
        if (byBarcode) action = 'update';
      }
      if (action === 'create' && name) {
        const byNameMatch = await this.prisma.product.findFirst({
          where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null },
        });
        if (byNameMatch) action = 'update';
      }

      rows.push({
        rowNumbers: [raw.rowNumber],
        barcode: raw.barcode,
        name,
        printedName: raw.printedName?.trim() || name || undefined,
        categoryId,
        categoryName,
        willCreateCategory,
        brandId: brandId ?? undefined,
        brandName,
        willCreateBrand,
        unitId,
        unitName,
        sizeId,
        sizeName,
        colorId,
        colorName,
        grade: raw.grade?.trim() || undefined,
        sellingPrice: sellingPrice ?? undefined,
        costPrice: costPrice ?? undefined,
        isService: String(raw.isServiceRaw ?? '').trim().toUpperCase() === 'Y',
        trackSerial: String(raw.trackSerialRaw ?? '').trim() === '1',
        supplierId: supplierId ?? undefined,
        supplierName,
        memberPricing,
        stocks,
        action,
        errors,
      });
    }

    return {
      rows,
      validCount: rows.filter((r) => r.errors.length === 0).length,
      errorCount: rows.filter((r) => r.errors.length > 0).length,
    };
  }

  /**
   * Confirm a previewed product import — creates/updates products via the
   * existing create()/update() paths, then upserts per-warehouse stocks.
   */
  async confirmProductImport(
    dto: { fileName: string; rows: any[] },
    userId: string,
  ): Promise<{
    created: number;
    updated: number;
    failed: number;
    errors: Array<{ row: string; error: string }>;
    productIds: string[];
  }> {
    const result = { created: 0, updated: 0, failed: 0, errors: [] as Array<{ row: string; error: string }>, productIds: [] as string[] };

    for (const row of dto.rows) {
      const label = row.rowNumbers ? `baris ${row.rowNumbers.join(',')}` : `produk '${row.name}'`;
      try {
        if (!row.name) throw new BadRequestException('Nama produk wajib diisi');
        if (!row.sellingPrice || row.sellingPrice <= 0) throw new BadRequestException('Harga Reguler wajib > 0');
        if (!row.costPrice || row.costPrice <= 0) throw new BadRequestException('Harga Modal wajib > 0');

        // Resolve category (id wins; else find-or-auto-create by name)
        let categoryId: string | undefined = row.categoryId || undefined;
        const categoryName = row.categoryName?.trim();
        if (!categoryId && categoryName) {
          const existing = await this.prisma.category.findFirst({
            where: { name: { equals: categoryName, mode: 'insensitive' } },
          });
          if (existing) categoryId = existing.id;
          else {
            const code = await this.generateCategoryCode(categoryName);
            const created = await this.prisma.category.create({ data: { name: categoryName, code } });
            categoryId = created.id;
          }
        }
        if (!categoryId) throw new BadRequestException('Kategori wajib diisi');

        // Resolve brand (optional; same find-or-create)
        let brandId: string | undefined = row.brandId || undefined;
        const brandName = row.brandName?.trim();
        if (!brandId && brandName) {
          const existing = await this.prisma.brand.findFirst({
            where: { name: { equals: brandName, mode: 'insensitive' } },
          });
          if (existing) brandId = existing.id;
          else {
            const code = await this.generateBrandCode(brandName);
            const created = await this.prisma.brand.create({ data: { name: brandName, code } });
            brandId = created.id;
          }
        }

        const productData: any = {
          name: row.name,
          printedName: row.printedName || row.name,
          barcode: row.barcode || undefined,
          categoryId,
          brandId: brandId || undefined,
          supplierId: row.supplierId || undefined,
          unitId: row.unitId || undefined,
          sizeId: row.sizeId || undefined,
          colorId: row.colorId || undefined,
          grade: row.grade || undefined,
          costPrice: row.costPrice,
          sellingPrice: row.sellingPrice,
          isService: row.isService || false,
          trackSerial: row.trackSerial || false,
          memberPricing: row.memberPricing && Object.keys(row.memberPricing).length > 0 ? row.memberPricing : undefined,
        };

        // Identity: barcode first, then name insensitive
        let existing: any = null;
        if (productData.barcode) {
          existing = await this.prisma.product.findFirst({
            where: { barcode: productData.barcode, deletedAt: null },
          });
        }
        if (!existing) {
          existing = await this.prisma.product.findFirst({
            where: { name: { equals: productData.name, mode: 'insensitive' }, deletedAt: null },
          });
        }

        let productId: string;
        if (existing) {
          const updated = await this.update(existing.id, productData, userId);
          productId = (updated as any).id;
          result.updated++;
        } else {
          const created = await this.create(productData, userId);
          productId = (created as any).id;
          result.created++;
        }
        result.productIds.push(productId);

        // Opening stocks — upsert quantityAvailable, never touch reserved
        for (const s of row.stocks || []) {
          if (!s.warehouseId || !(s.quantity > 0)) continue;
          await this.prisma.productStock.upsert({
            where: { productId_warehouseId: { productId, warehouseId: s.warehouseId } },
            create: { productId, warehouseId: s.warehouseId, quantityAvailable: s.quantity },
            update: { quantityAvailable: s.quantity },
          });
        }
      } catch (error: any) {
        result.failed++;
        result.errors.push({ row: label, error: error.message || 'Unknown error' });
      }
    }

    return result;
  }

  /**
   * Parse CSV line handling quoted values
   */
  private parseCSVLine(line: string, delimiter: string = ','): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Generate a unique category code from a name
   * Format: CAT-{SLUGIFIED_NAME} (with random suffix on conflict)
   */
  private async generateCategoryCode(name: string): Promise<string> {
    const baseCode = 'CAT-' + name
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 20);

    let code = baseCode;
    let attempts = 0;
    while (attempts < 10) {
      const existing = await this.prisma.category.findUnique({ where: { code } });
      if (!existing) return code;
      attempts++;
      code = `${baseCode}_${randomBytes(2).toString('hex').toUpperCase()}`;
    }
    return code;
  }

  /**
   * Generate a unique brand code from a name
   * Format: BRAND-{SLUGIFIED_NAME} (with random suffix on conflict)
   */
  private async generateBrandCode(name: string): Promise<string> {
    const baseCode = 'BRAND-' + name
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 20);

    let code = baseCode;
    let attempts = 0;
    while (attempts < 10) {
      const existing = await this.prisma.brand.findUnique({ where: { code } });
      if (!existing) return code;
      attempts++;
      code = `${baseCode}_${randomBytes(2).toString('hex').toUpperCase()}`;
    }
    return code;
  }

  /**
   * Escape CSV value
   */
  private escapeCSV(value: string, delimiter: string = ','): string {
    if (!value) return '';
    // If value contains delimiter, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

