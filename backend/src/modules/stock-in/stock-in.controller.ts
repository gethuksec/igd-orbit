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
import { StockInService } from './stock-in.service';
import { CreateStockInDto } from './dto/create-stock-in.dto';
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

@Controller('stock-in')
@UseGuards(JwtAuthGuard)
export class StockInController {
  constructor(private readonly stockInService: StockInService) {}

  /**
   * Create a Stock In document.
   * POST /api/v1/stock-in
   * Stock operators (CSO/SPV/HS) plus managers/owners.
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async create(@Body() dto: CreateStockInDto, @Request() req: any) {
    return this.stockInService.create(dto, req.user.id);
  }

  /** Supporting list: active GOOD outlet warehouses (optionally by outlet). */
  @Get('warehouses')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async warehouses(@Query('outletId') outletId?: string) {
    return this.stockInService.findGoodWarehouses(outletId);
  }

  /** Supporting list: product search with pricing defaults. */
  @Get('products')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async products(@Query('q') q?: string, @Query('limit') limit?: string) {
    return this.stockInService.searchProducts(q, limit ? parseInt(limit, 10) : 15);
  }

  /** Supporting list: active customer tiers (Silver/Gold/Platinum). */
  @Get('tiers')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async tiers() {
    return this.stockInService.getTiers();
  }

  /**
   * IGDERP-97 (I4) — Excel import/export. Template === export columns
   * (round-trip). Uploaded files are parsed in memory, never stored.
   */
  @Get('import/template')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async importTemplate(@Res() res: Response) {
    const buffer = await this.stockInService.buildImportTemplate();
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="template-stok-masuk.xlsx"',
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  @Post('import/preview')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  @UseInterceptors(FileInterceptor('file'))
  async importPreview(@UploadedFile() file: any) {
    if (!file?.buffer) throw new BadRequestException('File Excel wajib diunggah');
    return this.stockInService.previewImport(file.buffer);
  }

  @Post('import/confirm')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async importConfirm(@Body() dto: ConfirmImportDto, @Request() req: any) {
    return this.stockInService.confirmImport(dto, req.user.id);
  }

  @Get('export')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async exportSnapshot(@Query('warehouseId') warehouseId: string, @Res() res: Response) {
    if (!warehouseId) throw new BadRequestException('warehouseId wajib diisi');
    const { buffer, filename } = await this.stockInService.exportSnapshot(warehouseId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  /** List Stock In documents (paginated, filters). */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async findAll(@Query() query: any) {
    return this.stockInService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      outletId: query.outletId,
      warehouseId: query.warehouseId,
      supplierId: query.supplierId,
      startDate: query.startDate,
      endDate: query.endDate,
    });
  }

  /** Detail of a Stock In document. */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async findById(@Param('id') id: string) {
    return this.stockInService.findById(id);
  }
}
