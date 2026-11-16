import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { WorkingLocationsService } from './services/working-locations.service';
import { WorkingLocationsController } from './working-locations.controller';

@Module({
  controllers: [WorkingLocationsController],
  providers: [PrismaService, WorkingLocationsService],
  exports: [WorkingLocationsService],
})
export class WorkingLocationsModule {}
