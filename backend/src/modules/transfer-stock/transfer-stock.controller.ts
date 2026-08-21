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
import { TransferStockService } from './transfer-stock.service';
import { CreateTransferStockDto } from './dto/create-transfer-stock.dto';

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

@Controller('transfer-stock')
@UseGuards(JwtAuthGuard)
export class TransferStockController {
  constructor(private readonly transferStockService: TransferStockService) {}

  /**
   * Create a completed Transfer Stock document (source OUT + destination IN
   * atomically). POST /api/v1/transfer-stock
   * Stock operators (CSO/SPV/HS) plus managers/owners.
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async create(@Body() dto: CreateTransferStockDto, @Request() req: any) {
    return this.transferStockService.create(dto, req.user.id);
  }

  /** Supporting list: active GOOD outlet warehouses (optionally by outlet). */
  @Get('warehouses')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async warehouses(@Query('outletId') outletId?: string) {
    return this.transferStockService.findWarehouses(outletId);
  }

  /** Supporting list: the single system-scoped Central Bad Stock warehouse. */
  @Get('central-bad')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async centralBad() {
    return this.transferStockService.findCentralBad();
  }

  /** Supporting list: product search with availability in a warehouse. */
  @Get('products')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async products(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.transferStockService.searchProducts(
      q,
      limit ? parseInt(limit, 10) : 15,
      warehouseId,
    );
  }

  /** List Transfer Stock documents (paginated, filters). */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async findAll(@Query() query: any) {
    return this.transferStockService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      outletId: query.outletId,
      warehouseId: query.warehouseId,
    });
  }

  /** Detail of a Transfer Stock document. */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(...INVENTORY_ROLES)
  async findById(@Param('id') id: string) {
    return this.transferStockService.findById(id);
  }
}
