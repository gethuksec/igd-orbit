import { Module } from '@nestjs/common';
import { ServiceCheckpointsController } from './service-checkpoints.controller';
import { ServiceCheckpointsService } from './service-checkpoints.service';
import { PrismaService } from '../../shared/services';

/**
 * Service Checkpoints Module
 * Kelengkapan master data (dynamic checklist for service forms)
 */
@Module({
  controllers: [ServiceCheckpointsController],
  providers: [ServiceCheckpointsService, PrismaService],
  exports: [ServiceCheckpointsService],
})
export class ServiceCheckpointsModule {}
