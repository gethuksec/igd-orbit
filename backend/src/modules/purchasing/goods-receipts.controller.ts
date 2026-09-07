import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { resolveBranchFilter } from '../../common/branch-access.util';
import { GoodsReceiptsService } from './services/goods-receipts.service';
import { CreateGoodsReceiptDto } from './dto/create-goods-receipt.dto';
import { ApproveGoodsReceiptDto } from './dto/approve-goods-receipt.dto';
import { RevisitGoodsReceiptDto, UpdateReceivingDto } from './dto/receiving.dto';

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
    @Request() req: ExpressRequest & { user: any },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // "Semua Cabang" default (22-Agu-2026): no branchId → restrict to user's branches
    let branchIds: string[] | undefined;
    if (!branchId) {
      branchIds = resolveBranchFilter(req, undefined).branchIds;
    }
    return this.goodsReceiptsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
      purchaseOrderId,
      branchId,
      branchIds,
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
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'SODO')
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveGoodsReceiptDto,
    @Request() req: ExpressRequest,
  ) {
    return this.goodsReceiptsService.approve(id, dto, req.user.id, req.user.roles);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'SODO')
  async reject(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req: ExpressRequest,
  ) {
    return this.goodsReceiptsService.reject(id, req.user.id, body.reason, req.user.roles);
  }

  @Post(':id/revisit')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'SODO')
  async revisit(
    @Param('id') id: string,
    @Body() dto: RevisitGoodsReceiptDto,
    @Request() req: ExpressRequest,
  ) {
    return this.goodsReceiptsService.revisit(id, dto, req.user.id, req.user.roles);
  }

  @Patch(':id/receiving')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'SPV', 'HS', 'SODO')
  async updateReceiving(
    @Param('id') id: string,
    @Body() dto: UpdateReceivingDto,
    @Request() req: ExpressRequest,
  ) {
    return this.goodsReceiptsService.updateReceiving(id, dto, req.user.id, req.user.roles);
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

