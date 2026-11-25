import { Product, Category, Brand, ProductStock } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Product with relations type
 */
type ProductWithRelations = Product & {
  category?: Category;
  subCategory?: { id: string; code: string; name: string } | null;
  brand?: Brand | null;
  supplier?: { id: string; name: string; customerCode: string } | null;
  unit?: { id: string; name: string } | null;
  size?: { id: string; name: string } | null;
  color?: { id: string; name: string } | null;
  productStocks?: (ProductStock & {
    branch?: { id: string; name: string; code: string } | null;
    warehouse?: {
      id: string;
      code: string;
      name: string;
      type: string;
      scope: string;
      outletId: string | null;
    } | null;
  })[];
};

/**
 * Sales velocity class (IGDERP-310).
 * fast = avg >= 1/day over the last 30d; medium = >= 3/week;
 * slow = any sale in the last 90d (or a young product with no history yet);
 * dead = no sale in the last 90d and warehouse age above 90d.
 */
export type SalesClass = 'fast' | 'medium' | 'slow' | 'dead';

/**
 * Per-row list annotations (IGDERP-310): sales, purchase-modal, and age signals.
 * Built by ProductsService.buildListAnnotations for the current page.
 */
export interface ProductListAnnotations {
  totalSold: number; // All-time gross units sold (never sold = 0)
  lastRestockAt: Date | null; // Latest IN movement, null when never restocked
  firstStockAt: Date | null; // Earliest IN movement (warehouse age base)
  lastPurchaseAt: Date | null; // Latest goods-receipt date (purchase age base)
  lastPurchasePrice: number | null; // Latest goods-receipt unit price (modal terakhir)
  avgPurchasePrice: number | null; // Weighted-average goods-receipt price (modal purata)
  sold90d: number; // Gross units sold in the last 90 days
  sold30d: number; // Gross units sold in the last 30 days
  sold7d: number; // Gross units sold in the last 7 days
  lastSaleAt: Date | null; // Latest sale date, null when never sold
}

/** Empty annotation row (no history yet). */
export function emptyAnnotations(): ProductListAnnotations {
  return {
    totalSold: 0,
    lastRestockAt: null,
    firstStockAt: null,
    lastPurchaseAt: null,
    lastPurchasePrice: null,
    avgPurchasePrice: null,
    sold90d: 0,
    sold30d: 0,
    sold7d: 0,
    lastSaleAt: null,
  };
}
/**
 * Stock summary type
 */
interface StockSummary {
  totalAvailable: number;
  totalReserved: number;
  totalDamaged: number;
  branches: Array<{
    warehouseId: string;
    branchId: string;
    branchName: string;
    available: number;
    reserved: number;
    damaged: number;
  }>;
}

/**
 * Transformed product response
 */
export interface TransformedProduct {
  id: string;
  barcode: string | null;
  sku: string;
  name: string;
  printedName?: string | null;
  description: string | null;
  categoryId: string;
  category?: {
    id: string;
    code: string;
    name: string;
  } | null;
  subCategoryId?: string | null;
  subCategory?: {
    id: string;
    code: string;
    name: string;
  } | null;
  brandId: string | null;
  brand?: {
    id: string;
    code: string;
    name: string;
    logoUrl: string | null;
  } | null;
  supplierId?: string | null;
  supplier?: {
    id: string;
    name: string;
    customerCode: string;
  } | null;
  costPrice: number;
  sellingPrice: number;
  minSellingPrice?: number | null;
  discountPercentage?: number | null;
  discountAmount?: number | null;
  effectivePrice: number;
  unitId: string | null;
  sizeId?: string | null;
  colorId?: string | null;
  unit?: { id: string; name: string } | null;
  size?: { id: string; name: string } | null;
  color?: { id: string; name: string } | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  weightGrams?: number | null;
  packageWeightGrams?: number | null;
  isService: boolean;
  trackSerial: boolean;
  trackBatch: boolean;
  trackExpiry?: boolean;
  expiryReturnLimitDays?: number | null;
  memberPricing: Record<string, any> | null;
  images: string[] | null;
  isActive: boolean;
  totalStock: number;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  stockSummary?: StockSummary;
  totalSold?: number; // All-time units sold (list annotation)
  lastRestockAt?: Date | null; // Latest IN movement, null when never restocked
  firstStockAt?: Date | null; // Earliest IN movement (IGDERP-310)
  lastPurchaseAt?: Date | null; // Latest goods-receipt date (IGDERP-310)
  lastSaleAt?: Date | null; // Latest sale date (IGDERP-310)
  grade?: string | null;
  modalTerakhir?: number | null; // Last purchase price; null when never purchased (IGDERP-310)
  modalPurata?: number | null; // Weighted-average purchase price; null when never purchased (IGDERP-310)
  nilaiStok?: number; // (modalPurata ?? costPrice) * net stock (IGDERP-310)
  umurHari?: number | null; // Days since last purchase/IN/created (IGDERP-310)
  usiaHari?: number | null; // Days since first IN/created (IGDERP-310)
  kelas?: SalesClass | null; // Sales velocity class (IGDERP-310)
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Product Transformer
 * Transforms product entity to safe response format
 */
export class ProductTransformer {
  /**
   * Convert Decimal to number
   */
  private static toNumber(value: Decimal | number | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }
    if (typeof value === 'number') {
      return value;
    }
    return value.toNumber();
  }

  /**
   * Calculate stock status
   */
  private static getStockStatus(totalStock: number): 'in_stock' | 'low_stock' | 'out_of_stock' {
    if (totalStock === 0) {
      return 'out_of_stock';
    }
    if (totalStock < 10) {
      return 'low_stock';
    }
    return 'in_stock';
  }

  /**
   * Whole days between now and the given date (null-safe).
   */
  private static daysSince(d: Date | null | undefined, now: number = Date.now()): number | null {
    if (!d) return null;
    const t = new Date(d).getTime();
    if (!Number.isFinite(t)) return null;
    return Math.max(0, Math.floor((now - t) / 86400000));
  }

  /**
   * Sales velocity class from gross windowed sales (IGDERP-310).
   * fast = >= 30 units in 30d (~1/day); medium = >= 12 in 30d or >= 3 in 7d
   * (~3/week); slow = any sale in 90d or a young product with no history;
   * dead = no sale in 90d and warehouse age above 90d.
   */
  static classifySales(sold30d: number, sold7d: number, sold90d: number, usiaHari: number | null): SalesClass {
    if (sold90d <= 0) return usiaHari !== null && usiaHari > 90 ? 'dead' : 'slow';
    if (sold30d >= 30) return 'fast';
    if (sold30d >= 12 || sold7d >= 3) return 'medium';
    return 'slow';
  }

  /**
   * Transform product entity to safe response
   * @param product - Product entity with relations
   * @param includeStockSummary - Whether to include detailed stock summary
   * @returns Transformed product object
   */
  static transform(
    product: ProductWithRelations,
    includeStockSummary: boolean = false,
    annotations?: Map<string, ProductListAnnotations>,
  ): TransformedProduct {
    // Calculate total stock across all branches
    const stocks = product.productStocks || [];
    const totalAvailable = stocks.reduce(
      (sum, stock) => sum + this.toNumber(stock.quantityAvailable),
      0,
    );
    const totalReserved = stocks.reduce(
      (sum, stock) => sum + this.toNumber(stock.quantityReserved),
      0,
    );
    const totalDamaged = stocks.reduce(
      (sum, stock) => sum + this.toNumber(stock.quantityDamaged),
      0,
    );
    const totalStock = totalAvailable - totalReserved;

    // Calculate discount amount and effective price
    const sellingPrice = this.toNumber(product.sellingPrice);
    const discountPercentage = (product as any).discountPercentage || 0;
    const discountAmount = (sellingPrice * discountPercentage) / 100;
    const effectivePrice = sellingPrice - discountAmount;

    // Build stock summary if requested
    let stockSummary: StockSummary | undefined;
    if (includeStockSummary && stocks.length > 0) {
      stockSummary = {
        totalAvailable,
        totalReserved,
        totalDamaged,
        branches: stocks.map((stock) => ({
          warehouseId: stock.warehouseId,
          branchId: stock.branchId ?? stock.warehouseId,
          branchName:
            (stock as any).warehouse?.name || (stock as any).branch?.name || 'Gudang Pusat',
          available: this.toNumber(stock.quantityAvailable),
          reserved: this.toNumber(stock.quantityReserved),
          damaged: this.toNumber(stock.quantityDamaged),
        })),
      };
    }

    // Parse images array
    let images: string[] | null = null;
    if (product.images) {
      try {
        if (Array.isArray(product.images)) {
          images = product.images as string[];
        } else if (typeof product.images === 'string') {
          images = JSON.parse(product.images);
        }
      } catch {
        images = null;
      }
    }

    // IGDERP-310: purchase-modal / age / velocity derivation (list annotations;
    // null when the caller did not build them, e.g. the detail endpoint).
    const ann = annotations?.get(product.id);
    const costPrice = this.toNumber(product.costPrice);
    const modalTerakhir = ann?.lastPurchasePrice ?? null;
    const modalPurata = ann?.avgPurchasePrice ?? null;
    const nilaiStok = (modalPurata ?? costPrice) * totalStock;
    const umurBase = ann?.lastPurchaseAt ?? ann?.lastRestockAt ?? product.createdAt;
    const usiaBase = ann?.firstStockAt ?? product.createdAt;
    const umurHari = this.daysSince(umurBase);
    const usiaHari = this.daysSince(usiaBase);
    const kelas = ann ? ProductTransformer.classifySales(ann.sold30d, ann.sold7d, ann.sold90d, usiaHari) : null;

    return {
      id: product.id,
      barcode: product.barcode,
      sku: product.sku,
      name: product.name,
      printedName: (product as any).printedName || null,
      description: product.description,
      categoryId: product.categoryId,
      category: product.category
        ? {
            id: product.category.id,
            code: product.category.code,
            name: product.category.name,
          }
        : null,
      subCategoryId: (product as any).subCategoryId || null,
      subCategory: (product as any).subCategory
        ? {
            id: (product as any).subCategory.id,
            code: (product as any).subCategory.code,
            name: (product as any).subCategory.name,
          }
        : null,
      brandId: product.brandId,
      brand: product.brand
        ? {
            id: product.brand.id,
            code: product.brand.code,
            name: product.brand.name,
            logoUrl: product.brand.logoUrl,
          }
        : null,
      supplierId: (product as any).supplierId || null,
      supplier: (product as any).supplier
        ? {
            id: (product as any).supplier.id,
            name: (product as any).supplier.name,
            customerCode: (product as any).supplier.customerCode,
          }
        : null,
      costPrice: this.toNumber(product.costPrice),
      sellingPrice,
      minSellingPrice: (product as any).minSellingPrice ? this.toNumber((product as any).minSellingPrice) : null,
      discountPercentage: discountPercentage > 0 ? discountPercentage : null,
      discountAmount: discountAmount > 0 ? discountAmount : null,
      effectivePrice,
      unitId: (product as any).unitId || null,
      sizeId: (product as any).sizeId || null,
      colorId: (product as any).colorId || null,
      unit: (product as any).unit ? { id: (product as any).unit.id, name: (product as any).unit.name } : null,
      size: (product as any).size ? { id: (product as any).size.id, name: (product as any).size.name } : null,
      color: (product as any).color ? { id: (product as any).color.id, name: (product as any).color.name } : null,
      lengthCm: (product as any).lengthCm ? this.toNumber((product as any).lengthCm) : null,
      widthCm: (product as any).widthCm ? this.toNumber((product as any).widthCm) : null,
      heightCm: (product as any).heightCm ? this.toNumber((product as any).heightCm) : null,
      weightGrams: (product as any).weightGrams ? this.toNumber((product as any).weightGrams) : null,
      packageWeightGrams: (product as any).packageWeightGrams ? this.toNumber((product as any).packageWeightGrams) : null,
      isService: (product as any).isService || false,
      trackSerial: product.trackSerial,
      trackBatch: product.trackBatch,
      trackExpiry: (product as any).trackExpiry || false,
      expiryReturnLimitDays: (product as any).expiryReturnLimitDays || null,
      memberPricing: product.memberPricing as Record<string, any> | null,
      images,
      isActive: product.isActive,
      totalStock,
      stockStatus: this.getStockStatus(totalStock),
      stockSummary,
      totalSold: annotations?.get(product.id)?.totalSold,
      lastRestockAt: annotations?.get(product.id)?.lastRestockAt ?? null,
      firstStockAt: ann?.firstStockAt ?? null,
      lastPurchaseAt: ann?.lastPurchaseAt ?? null,
      lastSaleAt: ann?.lastSaleAt ?? null,
      grade: (product as any).grade ?? null,
      modalTerakhir,
      modalPurata,
      nilaiStok,
      umurHari,
      usiaHari,
      kelas,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      deletedAt: product.deletedAt,
    };
  }

  /**
   * Transform array of products
   * @param products - Array of product entities
   * @param includeStockSummary - Whether to include detailed stock summary
   * @returns Array of transformed product objects
   */
  static transformMany(
    products: ProductWithRelations[],
    includeStockSummary: boolean = false,
    annotations?: Map<string, ProductListAnnotations>,
  ): TransformedProduct[] {
    return products.map((product) => this.transform(product, includeStockSummary, annotations));
  }
}

