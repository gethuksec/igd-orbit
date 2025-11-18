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
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
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
   * Get overall product statistics
   * GET /api/v1/products/statistics
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get('statistics')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async getStatistics() {
    return this.productsService.getStatistics();
  }

  /**
   * List products with advanced filtering
   * GET /api/v1/products
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findAll(@Query() query: ListProductsDto) {
    try {
      return await this.productsService.findAll(query);
    } catch (error) {
      console.error('Error in products.findAll:', error);
      throw error;
    }
  }

  /**
   * Export to CSV/Excel
   * GET /api/v1/products/export
   * Permissions: OWNER, CSO, CMO, SPV, HS, ASA
   * NOTE: Must be before @Get(':id') to avoid route conflict
   */
  @Get('export')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async export(@Query() query: ListProductsDto, @Res() res: Response): Promise<void> {
    const csv = await this.productsService.exportToCSV(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="products-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 support
  }

  /**
   * Get product detail with stock info
   * GET /api/v1/products/:id
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findById(@Param('id') id: string) {
    return this.productsService.findById(id, true);
  }

  /**
   * Create new product
   * POST /api/v1/products
   * Permissions: OWNER, CSO, CMO, SPV, HS, ASA
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
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
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get(':id/stock')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async getStock(@Param('id') id: string) {
    return this.productsService.getStock(id);
  }

  /**
   * Get product activity history
   * GET /api/v1/products/:id/activity
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get(':id/activity')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async getActivityHistory(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.productsService.getActivityHistory(id, pageNum, limitNum);
  }

  /**
   * Bulk import via CSV
   * POST /api/v1/products/import
   * Permissions: CSO, CMO, SPV, ASA
   */
  @Post('import')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'ASA')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async import(
    @UploadedFile() file: any,
    @Request() req: ExpressRequest & { user: any },
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return this.productsService.importFromCSV(file.buffer.toString('utf-8'), req.user.id);
  }

}

