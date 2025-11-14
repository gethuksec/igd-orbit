import { Product, Category, Brand, ProductStock } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Product with relations type
 */
type ProductWithRelations = Product & {
  category?: Category;
  brand?: Brand | null;
  productStocks?: ProductStock[];
};

/**
 * Stock summary type
 */
interface StockSummary {
  totalAvailable: number;
  totalReserved: number;
  totalDamaged: number;
  branches: Array<{
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
  brandId: string | null;
  brand?: {
    id: string;
    code: string;
    name: string;
    logoUrl: string | null;
  } | null;
  costPrice: number;
  sellingPrice: number;
  discountPercentage?: number | null;
  discountAmount?: number | null;
  effectivePrice: number;
  unit: string;
  size?: string | null;
  color?: string | null;
  weightGrams?: number | null;
  isService: boolean;
  trackSerial: boolean;
  trackBatch: boolean;
  memberPricing: Record<string, any> | null;
  images: string[] | null;
  isActive: boolean;
  totalStock: number;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  stockSummary?: StockSummary;
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
   * Transform product entity to safe response
   * @param product - Product entity with relations
   * @param includeStockSummary - Whether to include detailed stock summary
   * @returns Transformed product object
   */
  static transform(
    product: ProductWithRelations,
    includeStockSummary: boolean = false,
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
          branchId: stock.branchId,
          branchName: (stock as any).branch?.name || 'Unknown',
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
      brandId: product.brandId,
      brand: product.brand
        ? {
            id: product.brand.id,
            code: product.brand.code,
            name: product.brand.name,
            logoUrl: product.brand.logoUrl,
          }
        : null,
      costPrice: this.toNumber(product.costPrice),
      sellingPrice,
      discountPercentage: discountPercentage > 0 ? discountPercentage : null,
      discountAmount: discountAmount > 0 ? discountAmount : null,
      effectivePrice,
      unit: product.unit,
      size: (product as any).size || null,
      color: (product as any).color || null,
      weightGrams: (product as any).weightGrams || null,
      isService: (product as any).isService || false,
      trackSerial: product.trackSerial,
      trackBatch: product.trackBatch,
      memberPricing: product.memberPricing as Record<string, any> | null,
      images,
      isActive: product.isActive,
      totalStock,
      stockStatus: this.getStockStatus(totalStock),
      stockSummary,
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
  ): TransformedProduct[] {
    return products.map((product) => this.transform(product, includeStockSummary));
  }
}

