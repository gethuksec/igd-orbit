import { Module } from '@nestjs/common';
import { DeviceTypesController } from './device-types.controller';
import { DeviceTypesService } from './device-types.service';
import { PrismaService } from '../../shared/services';

/**
 * Device Types Module (IGDERP-169)
 * Master data for Smart Repair device types.
 */
@Module({
  controllers: [DeviceTypesController],
  providers: [DeviceTypesService, PrismaService],
  exports: [DeviceTypesService],
})
export class DeviceTypesModule {}
