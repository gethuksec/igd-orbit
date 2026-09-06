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

  /** Create a completed Mutasi document. POST /api/v1/mutasi */
  @Post()
  @UseGuards(RolesGuard)
  @Roles(...MUTASI_ROLES)
  async create(@Body() dto: CreateMutasiDto, @Request() req: any) {
    return this.mutasiService.create(dto, req.user.id);
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
