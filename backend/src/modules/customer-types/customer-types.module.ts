import { Module } from '@nestjs/common';
import { CustomerTypesController } from './customer-types.controller';
import { CustomerTypesService } from './customer-types.service';
import { PrismaService } from '../../shared/services';

/**
 * Sales Types Module
 * Handles sales type management operations
 */
@Module({
  controllers: [CustomerTypesController],
  providers: [CustomerTypesService, PrismaService],
  exports: [CustomerTypesService],
})
export class CustomerTypesModule {}
