import { Module } from '@nestjs/common';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { PrismaService } from '../../shared/services';

/**
 * Brands Module
 * Handles brand management operations
 */
@Module({
  controllers: [BrandsController],
  providers: [BrandsService, PrismaService],
  exports: [BrandsService],
})
export class BrandsModule {}

