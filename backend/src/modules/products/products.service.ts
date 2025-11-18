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
    if (include.includes('stock')) {
      includeObj.productStocks = {
        select: {
          id: true,
          branchId: true,
          quantityAvailable: true,
          quantityReserved: true,
          quantityDamaged: true,
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
      description: createProductDto.description || null,
      categoryId: createProductDto.categoryId,
      brandId: createProductDto.brandId || null,
      costPrice: createProductDto.costPrice,
      sellingPrice: createProductDto.sellingPrice,
      unit: createProductDto.unit || 'pcs',
      isActive: createProductDto.isActive !== undefined ? createProductDto.isActive : true,
      trackSerial: createProductDto.trackSerial || false,
      trackBatch: createProductDto.trackBatch || false,
      memberPricing: createProductDto.memberPricing || null,
      images: createProductDto.images || null,
    };

    // Note: size, color, weightGrams, isService, discountPercentage are not in Prisma Product schema
    // These fields might be stored in memberPricing JSON or calculated from category
    // They are kept in DTO for future use but not saved to Product table directly

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
    // Note: size, color, weightGrams, isService, discountPercentage are not in Prisma Product schema
    // These fields might be stored in memberPricing JSON or calculated from category
    // They are kept in DTO for future use but not saved to Product table directly

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
   * Get product activity history (stock movements, price changes, status changes, etc.)
   * @param productId - Product ID
   * @param page - Page number
   * @param limit - Items per page
   * @returns Activity history with pagination
   */
  async getActivityHistory(productId: string, page: number = 1, limit: number = 3) {
    const skip = (page - 1) * limit;

    // Get stock movements - optimize by selecting only needed fields
    const [stockMovements, stockMovementsCount] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: { productId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
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
      }),
      this.prisma.stockMovement.count({
        where: { productId },
      }),
    ]);

    // Transform to activity log format
    const activities = stockMovements.map((movement) => {
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

      return {
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
        createdBy: movement.createdBy, // User ID - will need to fetch user details if needed
      };
    });

    return {
      data: activities,
      meta: {
        total: stockMovementsCount,
        page,
        limit,
        totalPages: Math.ceil(stockMovementsCount / limit),
      },
    };
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
   * @param query - List products query parameters
   * @returns CSV string
   */
  async exportToCSV(query: ListProductsDto): Promise<string> {
    // Get all products (no pagination for export) with stock summary
    const products = await this.findAll({ ...query, page: 1, limit: 10000, include: ['category', 'brand', 'stock'] });
    const data = products.data || [];

    // CSV Headers based on template (semicolon-separated)
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

    for (const product of data) {
      // Get member pricing
      const memberPricing = (product as any).memberPricing || {};
      const platinum = memberPricing.platinum?.discount || '';
      const gold = memberPricing.gold?.discount || '';
      const silver = memberPricing.silver?.discount || '';

      // Get stock per branch (simplified - would need branch mapping)
      const stockSummary = (product as any).stockSummary;
      const branchStocks: Record<string, number> = {};
      if (stockSummary?.branches) {
        stockSummary.branches.forEach((branch: any) => {
          branchStocks[branch.branchName] = branch.available - branch.reserved;
        });
      }

      // Get quantity pricing (from memberPricing or default)
      const qtyPricing: Record<string, { qty: string; price: string }> = {};
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

      const row = [
        this.escapeCSV(product.barcode || '', ';'),
        this.escapeCSV(product.sku || '', ';'),
        this.escapeCSV(product.name || '', ';'),
        this.escapeCSV((product as any).printedName || product.name || '', ';'),
        product.unit || 'pcs',
        product.category?.name || '',
        '', // Sub Kategori - not in schema
        product.brand?.name || '',
        (product as any).size || '',
        (product as any).color || '',
        '', // Panjang(cm) - not in schema
        '', // Lebar(cm) - not in schema
        '', // Tinggi(cm) - not in schema
        (product as any).weightGrams ? String((product as any).weightGrams) : '',
        '', // Berat Paket (gram) - not in schema
        product.sellingPrice ? String(product.sellingPrice) : '',
        product.discountPercentage ? String(product.discountPercentage) : '',
        product.effectivePrice ? String(product.effectivePrice) : '',
        product.sellingPrice ? String(product.sellingPrice) : '', // Harga Jual Minimum
        (product as any).isService ? 'Y' : 'N',
        product.trackSerial ? '1' : '2',
        product.trackBatch ? 'Y' : 'N',
        'N', // Menggunakan Tgl Kadaluarsa - not in schema
        '', // Batas Retur Kadaluarsa - not in schema
        product.costPrice ? String(product.costPrice) : '',
        '', // Supplier - not in schema
        String(branchStocks['IGD Jember - Spare Part - IGD Group MWH'] || 0),
        String(branchStocks['IGD Kalisat - Spare Part - IGD Kalisat - Spare Part'] || 0),
        String(branchStocks['IGD Jember - Spare Part - IGD Jember - Spare Part'] || 0),
        String(branchStocks['IGD Kalisat - Service - IGD Kalisat - Service'] || 0),
        '', // IGD Jember - Spare Part - Harga Outlet
        '', // IGD Jember - Spare Part - Diskon
        '', // IGD Kalisat - Service - Harga Outlet
        '', // IGD Kalisat - Service - Diskon
        '', // IGD Kalisat - Spare Part - Harga Outlet
        '', // IGD Kalisat - Spare Part - Diskon
        platinum ? String(platinum) : '',
        gold ? String(gold) : '',
        silver ? String(silver) : '',
        '', // User - not in schema
        qtyPricing[1].qty,
        qtyPricing[1].price,
        qtyPricing[2].qty,
        qtyPricing[2].price,
        qtyPricing[3].qty,
        qtyPricing[3].price,
        qtyPricing[4].qty,
        qtyPricing[4].price,
        qtyPricing[5].qty,
        qtyPricing[5].price,
        qtyPricing[6].qty,
        qtyPricing[6].price,
        qtyPricing[7].qty,
        qtyPricing[7].price,
        qtyPricing[8].qty,
        qtyPricing[8].price,
        qtyPricing[9].qty,
        qtyPricing[9].price,
        qtyPricing[10].qty,
        qtyPricing[10].price,
      ];
      csvLines.push(row.join(';'));
    }

    return csvLines.join('\n');
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

