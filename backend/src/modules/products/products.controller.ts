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
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request as ExpressRequest } from 'express';
import { ProductsService } from './products.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateProductDto, UpdateProductDto, ListProductsDto } from './dto';

/**
 * Products Controller
 * Handles product management endpoints
 */
@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * List products with advanced filtering
   * GET /api/v1/products
   * Permissions: All authenticated users
   */
  @Get()
  async findAll(@Query() query: ListProductsDto) {
    try {
      return await this.productsService.findAll(query);
    } catch (error) {
      console.error('Error in products.findAll:', error);
      throw error;
    }
  }

  /**
   * Get product detail with stock info
   * GET /api/v1/products/:id
   * Permissions: All authenticated users
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.productsService.findById(id, true);
  }

  /**
   * Create new product
   * POST /api/v1/products
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createProductDto: CreateProductDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.productsService.create(createProductDto, req.user.id);
  }

  /**
   * Update product
   * PUT /api/v1/products/:id
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.productsService.update(id, updateProductDto, req.user.id);
  }

  /**
   * Soft delete product
   * DELETE /api/v1/products/:id
   * Permissions: CSO, SPV (with approval if has stock)
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    await this.productsService.softDelete(id, req.user.id);
  }

  /**
   * Duplicate product with new SKU
   * POST /api/v1/products/:id/duplicate
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Post(':id/duplicate')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.CREATED)
  async duplicate(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.productsService.duplicate(id, req.user.id);
  }

  /**
   * Get stock across all branches
   * GET /api/v1/products/:id/stock
   * Permissions: All authenticated users
   */
  @Get(':id/stock')
  async getStock(@Param('id') id: string) {
    return this.productsService.getStock(id);
  }

  /**
   * Bulk import via CSV
   * POST /api/v1/products/import
   * Permissions: CSO, CMO, SPV, ASA
   * TODO: Implement CSV parsing and bulk import
   */
  @Post('import')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'ASA')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async import(
    @UploadedFile() _file: Express.Multer.File,
    @Request() _req: ExpressRequest & { user: any },
  ) {
    // TODO: Implement CSV parsing
    // 1. Parse CSV file
    // 2. Validate each row
    // 3. Check for duplicates
    // 4. Bulk create products
    // 5. Return import results

    return {
      message: 'Import functionality will be implemented in next phase',
      note: 'This endpoint accepts CSV file upload for bulk product import',
    };
  }

  /**
   * Export to CSV/Excel
   * GET /api/v1/products/export
   * Permissions: CSO, CMO, SPV, HS, ASA
   * TODO: Implement export functionality
   */
  @Get('export')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async export(@Query() _query: ListProductsDto) {
    // TODO: Implement export functionality
    // 1. Get products based on filters
    // 2. Format as CSV/Excel
    // 3. Return file download

    return {
      message: 'Export functionality will be implemented in next phase',
      note: 'This endpoint will export products to CSV/Excel format based on current filters',
    };
  }
}

