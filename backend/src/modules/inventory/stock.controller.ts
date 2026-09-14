import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { resolveBranchFilter } from '../../common/branch-access.util';
import { StockService } from './stock.service';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { ListStockDto } from './dto/list-stock.dto';
import { ListMovementsDto } from './dto/list-movements.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('stock')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async getStockSummary(
    @Query() query: ListStockDto,
    @Request() req: any,
  ) {
    // "Semua Cabang" default (22-Agu-2026): no branchId → restrict to user's branches
    if (!query.branchId && !query.warehouseId) {
      query.branchIds = resolveBranchFilter(req, undefined).branchIds;
    }
    return this.stockService.getStockSummary(query);
  }

  @Get('stock/export')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async exportStock(
    @Query() query: ListStockDto,
    @Query('columns') columns: string | undefined,
    @Request() req: any,
    @Res() res: Response,
  ): Promise<void> {
    // NOTE: declared before @Get('stock/:productId') to avoid route conflict.
    // "Semua Cabang" default (22-Agu-2026): no branchId → user's branches.
    // Filters (search/status/threshold) ride along via ListStockDto — IGDERP-106.
    if (!query.branchId && !query.warehouseId) {
      query.branchIds = resolveBranchFilter(req, undefined).branchIds;
    }
    const csv = await this.stockService.exportStockCsv(query, columns);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="stok-${new Date().toISOString().split('T')[0]}.csv"`,
    );
    res.send('\\uFEFF' + csv); // BOM for Excel UTF-8 support
  }

  @Get('stock/:productId')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async getProductStock(@Param('productId') productId: string) {
    return this.stockService.getProductStock(productId);
  }

  @Post('adjustment')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS')
  async adjustStock(@Body() dto: StockAdjustmentDto, @Request() req: any) {
    return this.stockService.adjustStock(dto, req.user.id);
  }

  @Get('movements')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async getStockMovementHistory(
    @Query() query: ListMovementsDto,
    @Request() req: any,
  ) {
    // "Semua Cabang" default (22-Agu-2026): no branchId → restrict to user's branches
    if (!query.branchId && !query.warehouseId) {
      query.branchIds = resolveBranchFilter(req, undefined).branchIds;
    }
    return this.stockService.getStockMovementHistory(query);
  }

  @Get('alerts')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async getLowStockAlerts(
    @Request() req: any,
    @Query('branchId') branchId?: string,
  ) {
    // "Semua Cabang" default (22-Agu-2026): no branchId → restrict to user's branches
    let branchIds: string[] | undefined;
    if (!branchId) {
      branchIds = resolveBranchFilter(req, undefined).branchIds;
    }
    return this.stockService.getLowStockAlerts(branchId, branchIds);
  }
}

