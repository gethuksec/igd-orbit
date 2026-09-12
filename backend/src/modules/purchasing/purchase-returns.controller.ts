import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { PurchaseReturnsService } from './services/purchase-returns.service';
import { CreatePurchaseReturnDto } from './dto/create-purchase-return.dto';

/**
 * IGDERP-84: Purchase returns (Retur Pembelian).
 * Permissions: purchasing team + management read; purchasing team writes.
 */
@Controller('purchasing/purchase-returns')
@UseGuards(RolesGuard)
export class PurchaseReturnsController {
  constructor(
    private readonly purchaseReturnsService: PurchaseReturnsService,
  ) {}

  @Get()
  @Roles(
    'CSO',
    'SPV',
    'HS',
    'ASA',
    'SODO',
    'CFO',
    'OWNER',
    'SUPERADMIN',
  )
  async findAll(
    @Query()
    query: {
      page?: string;
      limit?: string;
      search?: string;
      purchaseOrderId?: string;
    },
  ) {
    return this.purchaseReturnsService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      purchaseOrderId: query.purchaseOrderId,
    });
  }

  @Get(':id')
  @Roles(
    'CSO',
    'SPV',
    'HS',
    'ASA',
    'SODO',
    'CFO',
    'OWNER',
    'SUPERADMIN',
  )
  async findById(@Param('id') id: string) {
    return this.purchaseReturnsService.findById(id);
  }

  @Post()
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO')
  async create(@Body() dto: CreatePurchaseReturnDto, @Req() req: any) {
    return this.purchaseReturnsService.create(dto, req.user.id);
  }
}
