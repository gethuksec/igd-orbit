import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { StockOutService } from './stock-out.service';
import { CreateStockOutDto } from './dto/create-stock-out.dto';
import { ConfirmImportDto } from './dto/confirm-import.dto';

const INVENTORY_ROLES = [
  'CSO',
  'SPV',
  'HS',
  'ASA',
  'SODO',
  'CS',
  'CR',
  'TC',
  'AS',
  'SMO',
  'AR',
  'CMO',
  'CFO',
  'CHR',
  'OWNER',
];

@Controller('stock-out')
@UseGuards(JwtAuthGuard)
export class StockOutController {
  constructor(private readonly stockOutService: StockOutService) {}

  /**
   * Create a Stock Out document.
   * POST /api/v1/stock-out
   * Stock operators (CSO/SPV/HS) plus managers/owners.
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async create(@Body() dto: CreateStockOutDto, @Request() req: any) {
    return this.stockOutService.create(dto, req.user.id);
  }

  /** Supporting list: active GOOD outlet warehouses (optionally by outlet) + Central Bad Stock. */
  @Get('warehouses')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async warehouses(@Query('outletId') outletId?: string) {
    return this.stockOutService.findSourceWarehouses(outletId);
  }

  /** Supporting list: product search with pricing defaults + availability in a warehouse. */
  @Get('products')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async products(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.stockOutService.searchProducts(
      q,
      limit ? parseInt(limit, 10) : 15,
      warehouseId,
    );
  }

  /**
   * IGDERP-97 (I4) — Excel import/export. Template === export columns
   * (round-trip). Uploaded files are parsed in memory, never stored.
   * Over-qty rows are skipped at confirm and reported per product.
   */
  @Get('import/template')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async importTemplate(@Res() res: Response) {
    const buffer = await this.stockOutService.buildImportTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template-stok-keluar.xlsx"',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post('import/preview')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  @UseInterceptors(FileInterceptor('file'))
  async importPreview(@UploadedFile() file: any, @Query('warehouseId') warehouseId: string) {
    if (!file?.buffer) throw new BadRequestException('File Excel wajib diunggah');
    if (!warehouseId) throw new BadRequestException('warehouseId wajib diisi');
    return this.stockOutService.previewImport(file.buffer, warehouseId);
  }

  @Post('import/confirm')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async importConfirm(@Body() dto: ConfirmImportDto, @Request() req: any) {
    return this.stockOutService.confirmImport(dto, req.user.id);
  }

  @Get('export')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async exportSnapshot(@Query('warehouseId') warehouseId: string, @Res() res: Response) {
    if (!warehouseId) throw new BadRequestException('warehouseId wajib diisi');
    const { buffer, filename } = await this.stockOutService.exportSnapshot(warehouseId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  /** List Stock Out documents (paginated, filters). */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async findAll(@Query() query: any) {
    return this.stockOutService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      outletId: query.outletId,
      warehouseId: query.warehouseId,
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }

  /** Detail of a Stock Out document. */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async findById(@Param('id') id: string) {
    return this.stockOutService.findById(id);
  }
}
