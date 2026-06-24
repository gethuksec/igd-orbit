import { Module } from '@nestjs/common';
import { SalesTransactionsController } from './sales-transactions.controller';
import { SalesTransactionsService } from './sales-transactions.service';
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
  controllers: [SalesTransactionsController, CustomerDepositsController],
  providers: [SalesTransactionsService, CustomerDepositsService, PrismaService],
  exports: [SalesTransactionsService, CustomerDepositsService],
})
export class SalesModule {}

