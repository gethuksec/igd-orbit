import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomerDepositsService } from './customer-deposits.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateCustomerDepositDto } from './dto';

/**
 * Customer Deposits Controller
 * Handles customer deposit endpoints (return credits, deposit payments)
 */
@Controller('customer-deposits')
@UseGuards(JwtAuthGuard)
export class CustomerDepositsController {
  constructor(private readonly customerDepositsService: CustomerDepositsService) {}

  /**
   * Create a return deposit
   * POST /api/v1/customer-deposits/return-credit
   * Credits a customer's deposit balance from a return
   */
  @Post('return-credit')
  @UseGuards(RolesGuard)
  @Roles('CS', 'CR', 'HS', 'SPV')
  @HttpCode(HttpStatus.CREATED)
  async createReturnDeposit(
    @Body() createDto: CreateCustomerDepositDto,
    @Req() req: any,
  ) {
    if (createDto.type !== 'return_credit') {
      createDto.type = 'return_credit';
    }
    return this.customerDepositsService.createReturnDeposit(createDto, req.user?.id);
  }

  /**
   * Use deposit to pay
   * POST /api/v1/customer-deposits/use
   * Deducts from customer deposit balance
   */
  @Post('use')
  @UseGuards(RolesGuard)
  @Roles('CS', 'CR', 'HS', 'SPV')
  @HttpCode(HttpStatus.OK)
  async useDeposit(
    @Body() body: { customerId: string; amount: number; referenceTransactionId?: string },
  ) {
    return this.customerDepositsService.useDeposit(
      body.customerId,
      body.amount,
      body.referenceTransactionId,
    );
  }

  /**
   * Get customer deposit balance
   * GET /api/v1/customer-deposits/balance/:customerId
   */
  @Get('balance/:customerId')
  async getBalance(@Param('customerId') customerId: string) {
    const balance = await this.customerDepositsService.getDepositBalance(customerId);
    return { customerId, balance };
  }

  /**
   * Get customer deposit history
   * GET /api/v1/customer-deposits/history/:customerId
   */
  @Get('history/:customerId')
  async getHistory(@Param('customerId') customerId: string) {
    return this.customerDepositsService.getDepositHistory(customerId);
  }

  /**
   * Refund deposit to customer
   * POST /api/v1/customer-deposits/refund
   */
  @Post('refund')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV')
  @HttpCode(HttpStatus.OK)
  async refundDeposit(
    @Body() body: { customerId: string; amount: number; notes?: string },
  ) {
    return this.customerDepositsService.refundDeposit(
      body.customerId,
      body.amount,
      body.notes,
    );
  }
}
