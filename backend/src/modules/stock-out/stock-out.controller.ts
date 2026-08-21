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
import { StockOutService } from './stock-out.service';
import { CreateStockOutDto } from './dto/create-stock-out.dto';

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
