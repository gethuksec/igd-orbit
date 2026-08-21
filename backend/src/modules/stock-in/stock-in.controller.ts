import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { StockInService } from './stock-in.service';
import { CreateStockInDto } from './dto/create-stock-in.dto';

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
