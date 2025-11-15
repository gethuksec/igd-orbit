import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { CustomersModule } from '../customers/customers.module';

/**
 * Suppliers Module
 * Handles supplier management
 * Note: Suppliers are stored as customers with customerType='wholesale'
 */
@Module({
  imports: [CustomersModule],
  controllers: [SuppliersController],
})
export class SuppliersModule {}

