import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { StockRequestsService } from './stock-requests.service';
import { CreateStockRequestDto } from './dto/create-stock-request.dto';
import {
  RotateIntakeTokenDto,
  UpdateStockRequestStatusDto,
} from './dto/update-stock-request-status.dto';
import { IntakeRateLimitGuard } from './guards/intake-rate-limit.guard';

/** Sidebar mirror (Inventory > Request): view for outlet + back-office roles. */
const VIEW_ROLES = [
  'SUPERADMIN',
  'OWNER',
  'CFO',
  'MGR',
  'CSO',
  'SPV',
  'HS',
  'ASA',
  'SODO',
];

/** Status transitions + PO linking: SODO owns the flow, MGR/OWNER supervise. */
const APPROVE_ROLES = ['SUPERADMIN', 'OWNER', 'MGR', 'SODO'];

@Controller('stock-requests')
export class StockRequestsController {
  constructor(private readonly stockRequestsService: StockRequestsService) {}

  // ─── Public intake (no login — GForm-style outlet link is the gate) ───

  @Get('intake/:token')
  async getIntakeContext(@Param('token') token: string) {
    return this.stockRequestsService.getIntakeContext(token);
  }

  @Get('intake/:token/products')
  async searchIntakeProducts(
    @Param('token') token: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stockRequestsService.searchIntakeProducts(
      token,
      q,
      limit ? parseInt(limit, 10) : 15,
    );
  }

  @Get('intake/:token/members/verify')
  async verifyIntakeMember(
    @Param('token') token: string,
    @Query('code') code?: string,
  ) {
    return this.stockRequestsService.verifyIntakeMember(token, code);
  }

  @Post('intake/:token')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(new IntakeRateLimitGuard(15, 10 * 60 * 1000))
  async createIntake(
    @Param('token') token: string,
    @Body() dto: CreateStockRequestDto,
  ) {
    return this.stockRequestsService.createIntake(token, dto);
  }

  // ─── Outlet token admin (guarded) ───

  @Post('intake-tokens')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...APPROVE_ROLES)
  async rotateIntakeToken(@Body() dto: RotateIntakeTokenDto) {
    return this.stockRequestsService.rotateIntakeToken(dto.branchId);
  }

  // ─── SODO review (guarded) ───

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...VIEW_ROLES)
  async getStats() {
    return this.stockRequestsService.getStats();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...VIEW_ROLES)
  async findAll(@Query() query: any) {
    return this.stockRequestsService.findAll({
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
      search: query.search,
      status: query.status,
      branchId: query.branchId,
    });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...VIEW_ROLES)
  async findById(@Param('id') id: string) {
    return this.stockRequestsService.findById(id);
  }

  @Patch(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...APPROVE_ROLES)
  async approve(@Param('id') id: string, @Request() req: any) {
    return this.stockRequestsService.approve(id, req.user?.id);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...APPROVE_ROLES)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStockRequestStatusDto,
    @Request() req: any,
  ) {
    return this.stockRequestsService.updateStatus(id, dto, req.user?.id);
  }
}
