import { Module } from '@nestjs/common';
import { SalesTransactionsController } from './sales-transactions.controller';
import { SalesTransactionsService } from './sales-transactions.service';
import { PrismaService } from '../../shared/services';
import { CustomersModule } from '../customers/customers.module';

/**
 * Sales Module
 * Handles sales and POS transaction operations
 */
@Module({
  imports: [CustomersModule],
  controllers: [SalesTransactionsController],
  providers: [SalesTransactionsService, PrismaService],
  exports: [SalesTransactionsService],
})
export class SalesModule {}

