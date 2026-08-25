import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SalesReturnsService } from './sales-returns.service';
import { CreateSalesReturnDto } from './dto';
import { JwtAuthGuard } from '../../shared/guards';

/**
 * Sales Returns Controller — IGDERP-85
 * Retur Penjualan: created from Riwayat Penjualan (Selesai), read-only list at /sales/returns.
 */
@Controller('sales-returns')
@UseGuards(JwtAuthGuard)
export class SalesReturnsController {
  constructor(private readonly salesReturnsService: SalesReturnsService) {}

  /** POST /api/v1/sales-returns — SUPERADMIN enforced in service (v1) */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateSalesReturnDto, @Req() req: any) {
    return this.salesReturnsService.create(dto, req.user?.id);
  }

  /** GET /api/v1/sales-returns — list (page/limit/search) */
  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('transactionId') transactionId?: string,
  ) {
    return this.salesReturnsService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      transactionId,
    });
  }

  /** GET /api/v1/sales-returns/by-transaction/:transactionId — detail page lookup */
  @Get('by-transaction/:transactionId')
  async findByTransaction(@Param('transactionId') transactionId: string) {
    return this.salesReturnsService.findByTransaction(transactionId);
  }

  /** GET /api/v1/sales-returns/:id */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.salesReturnsService.findOne(id);
  }
}
