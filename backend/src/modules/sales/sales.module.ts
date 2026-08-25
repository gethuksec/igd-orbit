import { Module } from '@nestjs/common';
import { SalesTransactionsController } from './sales-transactions.controller';
import { SalesTransactionsService } from './sales-transactions.service';
import { SalesReturnsController } from './sales-returns.controller';
import { SalesReturnsService } from './sales-returns.service';
import { CustomerDepositsController } from './customer-deposits.controller';
import { CustomerDepositsService } from './customer-deposits.service';
import { PrismaService } from '../../shared/services';
import { CustomersModule } from '../customers/customers.module';
import { FinanceModule } from '../finance/finance.module';

/**
 * Sales Module
 * Handles sales and POS transaction operations
 */
@Module({
  imports: [CustomersModule, FinanceModule],
  controllers: [
    SalesTransactionsController,
    SalesReturnsController,
    CustomerDepositsController,
  ],
  providers: [
    SalesTransactionsService,
    SalesReturnsService,
    CustomerDepositsService,
    PrismaService,
  ],
  exports: [SalesTransactionsService, SalesReturnsService, CustomerDepositsService],
})
export class SalesModule {}

