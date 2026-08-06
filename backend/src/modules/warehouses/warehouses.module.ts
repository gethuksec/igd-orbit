import { Module } from '@nestjs/common';
import { WarehousesController } from './warehouses.controller';
import { WarehousesService } from './warehouses.service';
import { PrismaService } from '../../shared/services';

/**
 * Warehouses Module
 * Handles warehouse management operations (D2)
 */
@Module({
  controllers: [WarehousesController],
  providers: [WarehousesService, PrismaService],
  exports: [WarehousesService],
})
export class WarehousesModule {}
