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
import { AccountsReceivableService } from './services/accounts-receivable.service';
import { RecordARPaymentDto } from './dto/record-ar-payment.dto';
import { WriteOffARDto } from './dto/write-off-ar.dto';

@Controller('accounts-receivable')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountsReceivableController {
  constructor(
    private readonly accountsReceivableService: AccountsReceivableService,
  ) {}

  /**
   * Get AR aging report
   * GET /api/v1/accounts-receivable
   * Permissions: CFO, CMO, CS
   */
  @Get()
  @Roles('CFO', 'CMO', 'CS', 'OWNER')
  async getAgingReport(@Query('asOfDate') asOfDate?: string) {
    return this.accountsReceivableService.getAgingReport(asOfDate);
  }

  /**
   * Get customer AR detail
   * GET /api/v1/accounts-receivable/:customerId
   * Permissions: CFO, CMO, CS
   */
  @Get(':customerId')
  @Roles('CFO', 'CMO', 'CS', 'OWNER')
  async getCustomerAR(@Param('customerId') customerId: string) {
    return this.accountsReceivableService.getCustomerAR(customerId);
  }

  /**
   * Record AR payment
   * POST /api/v1/accounts-receivable/:id/payment
   * Permissions: CFO, Finance Staff
   */
  @Post(':id/payment')
  @Roles('CFO', 'FINANCE')
  async recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordARPaymentDto,
    @Request() req: any,
  ) {
    return this.accountsReceivableService.recordPayment(id, dto, req.user.id);
  }

  /**
   * Write off bad debt
   * POST /api/v1/accounts-receivable/:id/writeoff
   * Permissions: CFO only
   */
  @Post(':id/writeoff')
  @Roles('CFO')
  async writeOff(
    @Param('id') id: string,
    @Body() dto: WriteOffARDto,
    @Request() req: any,
  ) {
    return this.accountsReceivableService.writeOff(id, dto, req.user.id);
  }
}

