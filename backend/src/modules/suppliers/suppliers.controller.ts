import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { CustomersService } from '../customers/customers.service';
import { PrismaService } from '../../shared/services';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  ListCustomersDto,
} from '../customers/dto';

/**
 * Suppliers Controller
 * Handles supplier management endpoints
 * Note: Suppliers are stored as customers with customerType='wholesale'
 */
@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * List suppliers with filters and search
   * GET /api/v1/suppliers
   * Permissions: All authenticated users
   */
  @Get()
  async findAll(@Query() query: ListCustomersDto) {
    // Force filter to only show wholesale customers (suppliers)
    const supplierQuery = {
      ...query,
      'filter[type]': ['wholesale'],
    };
    return this.customersService.findAll(supplierQuery as ListCustomersDto);
  }

  /**
   * Get supplier detail
   * GET /api/v1/suppliers/:id
   * Permissions: All authenticated users
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    try {
      const customer = await this.customersService.findById(id);
      // Verify it's a supplier
      if (customer.customerType !== 'wholesale') {
        throw new NotFoundException('Supplier not found');
      }
      return customer;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Supplier not found');
    }
  }

  /**
   * Get products from supplier
   * GET /api/v1/suppliers/:id/products
   * Permissions: All authenticated users
   */
  @Get(':id/products')
  async getProducts(@Param('id') id: string) {
    // Verify it's a supplier
    const customer = await this.customersService.findById(id);
    if (customer.customerType !== 'wholesale') {
      throw new NotFoundException('Supplier not found');
    }
    
    // Get products where supplierId matches
    const products = await this.prisma.product.findMany({
      where: {
        supplierId: id,
        deletedAt: null,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
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
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return {
      data: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        barcode: p.barcode,
        name: p.name,
        category: p.category,
        brand: p.brand,
        costPrice: p.costPrice.toNumber(),
        sellingPrice: p.sellingPrice.toNumber(),
        totalStock: p.productStocks.reduce(
          (sum, stock) => sum + stock.quantityAvailable.toNumber() - stock.quantityReserved.toNumber(),
          0,
        ),
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  }

  /**
   * Get purchase history (stock movements where supplier is involved)
   * GET /api/v1/suppliers/:id/purchases
   * Permissions: All authenticated users
   */
  @Get(':id/purchases')
  async getPurchaseHistory(
    @Param('id') id: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    // Verify it's a supplier
    const customer = await this.customersService.findById(id);
    if (customer.customerType !== 'wholesale') {
      throw new NotFoundException('Supplier not found');
    }
    
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;
    
    // Get product IDs from this supplier
    const supplierProductIds = await this.prisma.product.findMany({
      where: {
        supplierId: id,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });
    
    const productIds = supplierProductIds.map((p) => p.id);
    
    const [movements, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: {
          productId: { in: productIds },
          OR: [
            { referenceType: 'PURCHASE' },
            { movementType: 'IN', referenceType: 'ADJUSTMENT' },
          ],
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
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
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      this.prisma.stockMovement.count({
        where: {
          productId: { in: productIds },
          OR: [
            { referenceType: 'PURCHASE' },
            { movementType: 'IN', referenceType: 'ADJUSTMENT' },
          ],
        },
      }),
    ]);
    
    return {
      data: movements.map((m) => ({
        id: m.id,
        product: m.product,
        branch: m.branch,
        movementType: m.movementType,
        referenceType: m.referenceType,
        quantity: m.quantityChange.toNumber(),
        quantityBefore: m.quantityBefore.toNumber(),
        quantityAfter: m.quantityAfter.toNumber(),
        notes: m.notes,
        createdBy: m.createdBy,
        createdAt: m.createdAt,
      })),
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Create new supplier
   * POST /api/v1/suppliers
   * Permissions: CMO, SPV, HS, CS, ASA, CR
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CMO', 'SPV', 'HS', 'CS', 'ASA', 'CR')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createSupplierDto: CreateCustomerDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    // Force customerType to wholesale
    const supplierData = {
      ...createSupplierDto,
      customerType: 'wholesale' as const,
    };
    return this.customersService.create(supplierData, req.user.id);
  }

  /**
   * Update supplier info
   * PUT /api/v1/suppliers/:id
   * Permissions: CMO, SPV, HS, CS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CMO', 'SPV', 'HS', 'CS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateCustomerDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    // Ensure customerType remains wholesale
    const supplierData = {
      ...updateSupplierDto,
      customerType: 'wholesale' as const,
    };
    return this.customersService.update(id, supplierData, req.user.id);
  }

  /**
   * Delete supplier (soft delete)
   * DELETE /api/v1/suppliers/:id
   * Permissions: CMO, SPV
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('CMO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    await this.customersService.softDelete(id, req.user.id);
  }
}

