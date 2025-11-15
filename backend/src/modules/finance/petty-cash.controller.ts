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
import { PettyCashService } from './services/petty-cash.service';
import { CreatePettyCashFundDto } from './dto/create-petty-cash-fund.dto';
import { RecordPettyCashTransactionDto } from './dto/record-petty-cash-transaction.dto';
import { ReconcilePettyCashDto } from './dto/reconcile-petty-cash.dto';

@Controller('petty-cash')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PettyCashController {
  constructor(private readonly pettyCashService: PettyCashService) {}

  /**
   * Create petty cash fund
   * POST /api/v1/petty-cash
   * Permissions: Custodian, HS, CFO
   */
  @Post()
  @Roles('HS', 'CFO')
  async createFund(@Body() dto: CreatePettyCashFundDto, @Request() req: any) {
    return this.pettyCashService.createFund(dto, req.user.id);
  }

  /**
   * List petty cash funds
   * GET /api/v1/petty-cash
   * Permissions: Custodian, HS, CFO
   */
  @Get()
  @Roles('HS', 'CFO', 'SPV')
  async findAll(
    @Query('branchId') branchId?: string,
    @Query('isActive') isActive?: boolean,
  ) {
    return this.pettyCashService.findAll({
      branchId,
      isActive: isActive === undefined ? undefined : isActive === true,
    });
  }

  /**
   * Get fund detail
   * GET /api/v1/petty-cash/:id
   * Permissions: Custodian, HS, CFO
   */
  @Get(':id')
  @Roles('HS', 'CFO', 'SPV')
  async findById(@Param('id') id: string) {
    return this.pettyCashService.findById(id);
  }

  /**
   * Record transaction
   * POST /api/v1/petty-cash/:id/transactions
   * Permissions: Custodian, HS, CFO
   */
  @Post(':id/transactions')
  @Roles('HS', 'CFO', 'SPV', 'CS', 'ASA')
  async recordTransaction(
    @Param('id') id: string,
    @Body() dto: RecordPettyCashTransactionDto,
    @Request() req: any,
  ) {
    return this.pettyCashService.recordTransaction(id, dto, req.user.id);
  }

  /**
   * Reconcile fund
   * POST /api/v1/petty-cash/:id/reconcile
   * Permissions: HS, CFO
   */
  @Post(':id/reconcile')
  @Roles('HS', 'CFO')
  async reconcile(
    @Param('id') id: string,
    @Body() dto: ReconcilePettyCashDto,
    @Request() req: any,
  ) {
    return this.pettyCashService.reconcileFund(id, dto, req.user.id);
  }
}

