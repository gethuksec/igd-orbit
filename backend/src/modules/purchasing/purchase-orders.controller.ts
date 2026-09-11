import {
  Controller,
  Get,
  Post,
  Put,
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
import { PurchaseOrdersService } from './services/purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from './dto/update-purchase-order.dto';
import { ApprovePurchaseOrderDto } from './dto/approve-purchase-order.dto';
import { RejectPurchaseOrderDto } from './dto/reject-purchase-order.dto';

interface ExpressRequest extends Request {
  user: {
    id: string;
    roles: string[];
  };
}

@Controller('purchasing/purchase-orders')
@UseGuards(JwtAuthGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO')
  async create(@Body() dto: CreatePurchaseOrderDto, @Request() req: ExpressRequest) {
    return this.purchaseOrdersService.create(dto, req.user.id);
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
    @Query('supplierId') supplierId?: string,
    @Query('branchId') branchId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // "Semua Cabang" default (22-Agu-2026): no branchId → restrict to user's branches
    let branchIds: string[] | undefined;
    if (!branchId) {
      branchIds = resolveBranchFilter(req, undefined).branchIds;
    }
    return this.purchaseOrdersService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search,
      status,
      supplierId,
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
    return this.purchaseOrdersService.findById(id);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @Request() req: ExpressRequest,
  ) {
    return this.purchaseOrdersService.update(id, dto, req.user.id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CFO', 'OWNER')
  async approve(
    @Param('id') id: string,
    @Body() dto: ApprovePurchaseOrderDto,
    @Request() req: ExpressRequest,
  ) {
    return this.purchaseOrdersService.approve(id, dto, req.user.id, req.user.roles);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CFO', 'OWNER', 'SUPERADMIN')
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectPurchaseOrderDto,
    @Request() req: ExpressRequest,
  ) {
    return this.purchaseOrdersService.reject(id, dto, req.user.id, req.user.roles);
  }
}

