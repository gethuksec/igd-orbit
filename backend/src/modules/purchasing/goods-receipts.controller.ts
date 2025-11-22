import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { GoodsReceiptsService } from './services/goods-receipts.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { ApproveGoodsReceiptDto } from './dto/approve-goods-receipt.dto';

interface ExpressRequest extends Request {
  user: {
    id: string;
    roles: string[];
  };
}

@Controller('purchasing/goods-receipts')
@UseGuards(JwtAuthGuard)
export class GoodsReceiptsController {
  constructor(private readonly goodsReceiptsService: GoodsReceiptsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO', 'SPV', 'CSO')
  async create(@Body() dto: CreateGoodsReceiptDto, @Request() req: ExpressRequest) {
    return this.goodsReceiptsService.create(dto, req.user.id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CFO', 'OWNER', 'SUPERADMIN')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.goodsReceiptsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
      purchaseOrderId,
      branchId,
      startDate,
      endDate,
    });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CFO', 'OWNER', 'SUPERADMIN')
  async findById(@Param('id') id: string) {
    return this.goodsReceiptsService.findById(id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CSO', 'OWNER')
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveGoodsReceiptDto,
    @Request() req: ExpressRequest,
  ) {
    return this.goodsReceiptsService.approve(id, dto, req.user.id, req.user.roles);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CSO', 'OWNER')
  async reject(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req: ExpressRequest,
  ) {
    return this.goodsReceiptsService.reject(id, req.user.id, body.reason, req.user.roles);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO', 'SPV', 'CSO', 'CFO', 'OWNER')
  async cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req: ExpressRequest,
  ) {
    return this.goodsReceiptsService.cancel(id, req.user.id, body.reason);
  }
}

