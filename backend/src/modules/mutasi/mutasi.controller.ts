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
import { MutasiService } from './mutasi.service';
import { CreateMutasiDto } from './dto/create-mutasi.dto';
import { ReceiveMutasiDto, SendMutasiDto } from './dto/lifecycle-mutasi.dto';

/**
 * Mutasi is the central ↔ outlet movement menu (IGDERP-140):
 * central-good/central-bad ↔ outlet warehouse, plus outlet ↔ outlet.
 * Operated by SODO (purchasing team); permission key inventory.mutasi.
 */
const MUTASI_ROLES = ['SUPERADMIN', 'OWNER', 'SODO'];

@Controller('mutasi')
@UseGuards(JwtAuthGuard)
export class MutasiController {
  constructor(private readonly mutasiService: MutasiService) {}

  /** Create a PENDING Mutasi document (IGDERP-173 transit → receive). POST /api/v1/mutasi */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(...MUTASI_ROLES)
  async create(@Body() dto: CreateMutasiDto, @Request() req: any) {
    return this.mutasiService.create(dto, req.user.id);
  }

  /** IGDERP-173: send a pending document (source OUT). */
  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles(...MUTASI_ROLES)
  async send(@Param('id') id: string, @Body() dto: SendMutasiDto, @Request() req: any) {
    return this.mutasiService.send(id, dto, req.user.id);
  }

  /** IGDERP-173: receive a sent document (destination IN + damage booking). */
  @Post(':id/receive')
  @UseGuards(RolesGuard)
  @Roles(...MUTASI_ROLES)
  async receive(@Param('id') id: string, @Body() dto: ReceiveMutasiDto, @Request() req: any) {
    return this.mutasiService.receive(id, dto, req.user.id);
  }

  /** IGDERP-173: cancel a pending/sent document. */
  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles(...MUTASI_ROLES)
  async cancel(@Param('id') id: string, @Request() req: any) {
    return this.mutasiService.cancel(id, req.user.id);
  }

  /** Supporting list: system central + outlet GOOD warehouses (with outlet). */
  @Get('warehouses')
  @UseGuards(RolesGuard)
  @Roles(...MUTASI_ROLES)
  async warehouses() {
    return this.mutasiService.findWarehouses();
  }

  /** Supporting list: product search with availability in a warehouse. */
  @Get('products')
  @UseGuards(RolesGuard)
  @Roles(...MUTASI_ROLES)
  async products(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.mutasiService.searchProducts(
      q,
      limit ? parseInt(limit, 10) : 15,
      warehouseId,
    );
  }

  /**
   * Supporting: destination availability per line for the create form
   * (IGDERP-173 §2: "form mutasi menampilkan stok asal + stok tujuan").
   */
  @Get('destination-stock')
  @UseGuards(RolesGuard)
  @Roles(...MUTASI_ROLES)
  async destinationStock(
    @Query('warehouseId') warehouseId: string,
    @Query('productIds') productIds?: string,
  ) {
    const ids = (productIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.mutasiService.findDestinationStock(warehouseId, ids);
  }

  /** List Mutasi documents (paginated, filters). */
  @Get()
  @UseGuards(RolesGuard)
  @Roles(...MUTASI_ROLES)
  async findAll(@Query() query: any) {
    return this.mutasiService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      outletId: query.outletId,
      warehouseId: query.warehouseId,
      status: query.status,
    });
  }

  /** Detail of a Mutasi document. */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(...MUTASI_ROLES)
  async findById(@Param('id') id: string) {
    return this.mutasiService.findById(id);
  }
}
