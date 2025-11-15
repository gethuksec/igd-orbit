import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateProductDto, UpdateProductDto, ListProductsDto } from './dto';
import { ProductTransformer, TransformedProduct } from './transformers/product.transformer';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

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
        branchId: stock.branchId,
        branchCode: stock.branch.code,
        branchName: stock.branch.name,
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
      'filter[brand]': filterBrand,
      'filter[status]': filterStatus = 'active',
      'filter[minPrice]': filterMinPrice,
      'filter[maxPrice]': filterMaxPrice,
      sort = 'name',
      order = 'asc',
      include = ['category', 'brand'],
    } = query;

    // Ensure page and limit are numbers (fallback if transform didn't work)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.ProductWhereInput = {
      deletedAt: filterStatus === 'all' ? undefined : filterStatus === 'active' ? null : { not: null },
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (filterCategory) {
      where.categoryId = filterCategory;
    }

    // Brand filter
    if (filterBrand) {
      where.brandId = filterBrand;
    }

    // Price range filter
    if (filterMinPrice !== undefined || filterMaxPrice !== undefined) {
      where.sellingPrice = {};
      if (filterMinPrice !== undefined) {
        where.sellingPrice.gte = filterMinPrice;
      }
      if (filterMaxPrice !== undefined) {
        where.sellingPrice.lte = filterMaxPrice;
      }
    }

    // Build include object
    const includeObj: Prisma.ProductInclude = {};
    if (include.includes('category')) {
      includeObj.category = true;
    }
    if (include.includes('brand')) {
      includeObj.brand = true;
    }
    if (include.includes('stock')) {
      includeObj.productStocks = {
        include: {
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
      return {
        data: ProductTransformer.transformMany(products, include.includes('stock')),
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
        brand: true,
        productStocks: includeStock
          ? {
              include: {
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

    // Prepare product data
    const productData: any = {
      sku,
      barcode: createProductDto.barcode || null,
      name: createProductDto.name,
      printedName: createProductDto.printedName || null,
      description: createProductDto.description || null,
      categoryId: createProductDto.categoryId,
      brandId: createProductDto.brandId || null,
      costPrice: createProductDto.costPrice,
      sellingPrice: createProductDto.sellingPrice,
      unit: createProductDto.unit || 'pcs',
      isActive: true,
      trackSerial: createProductDto.trackSerial || false,
      trackBatch: createProductDto.trackBatch || false,
      memberPricing: createProductDto.memberPricing || null,
      images: createProductDto.images || null,
    };

    // Add optional fields if they exist in DTO
    if (createProductDto.size !== undefined) {
      productData.size = createProductDto.size;
    }
    if (createProductDto.color !== undefined) {
      productData.color = createProductDto.color;
    }
    if (createProductDto.weightGrams !== undefined) {
      productData.weightGrams = createProductDto.weightGrams;
    }
    if (createProductDto.isService !== undefined) {
      productData.isService = createProductDto.isService;
    }
    if (createProductDto.discountPercentage !== undefined) {
      productData.discountPercentage = createProductDto.discountPercentage;
    }

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
    if (updateProductDto.brandId !== undefined) {
      updateData.brandId = updateProductDto.brandId || null;
    }
    if (updateProductDto.costPrice !== undefined) {
      updateData.costPrice = updateProductDto.costPrice;
    }
    if (updateProductDto.sellingPrice !== undefined) {
      updateData.sellingPrice = updateProductDto.sellingPrice;
    }
    if (updateProductDto.unit !== undefined) {
      updateData.unit = updateProductDto.unit;
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
    if (updateProductDto.isActive !== undefined) {
      updateData.isActive = updateProductDto.isActive;
    }
    if (updateProductDto.size !== undefined) {
      updateData.size = updateProductDto.size || null;
    }
    if (updateProductDto.color !== undefined) {
      updateData.color = updateProductDto.color || null;
    }
    if (updateProductDto.weightGrams !== undefined) {
      updateData.weightGrams = updateProductDto.weightGrams || null;
    }
    if (updateProductDto.isService !== undefined) {
      updateData.isService = updateProductDto.isService;
    }
    if (updateProductDto.discountPercentage !== undefined) {
      updateData.discountPercentage = updateProductDto.discountPercentage || null;
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
      printedName: (originalProduct as any).printedName || null,
      description: originalProduct.description,
      categoryId: originalProduct.categoryId,
      brandId: originalProduct.brandId,
      costPrice: originalProduct.costPrice,
      sellingPrice: originalProduct.sellingPrice,
      unit: originalProduct.unit,
      isActive: true,
      trackSerial: originalProduct.trackSerial,
      trackBatch: originalProduct.trackBatch,
      memberPricing: originalProduct.memberPricing,
      images: originalProduct.images,
    };

    // Copy optional fields
    if ((originalProduct as any).size) {
      duplicateData.size = (originalProduct as any).size;
    }
    if ((originalProduct as any).color) {
      duplicateData.color = (originalProduct as any).color;
    }
    if ((originalProduct as any).weightGrams) {
      duplicateData.weightGrams = (originalProduct as any).weightGrams;
    }
    if ((originalProduct as any).isService !== undefined) {
      duplicateData.isService = (originalProduct as any).isService;
    }
    if ((originalProduct as any).discountPercentage) {
      duplicateData.discountPercentage = (originalProduct as any).discountPercentage;
    }

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
}

