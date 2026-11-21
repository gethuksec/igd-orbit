import { Module } from '@nestjs/common';
import { LiburController } from './libur.controller';
import { LiburService } from './libur.service';
import { PrismaService } from '../../shared/services';
import { ShiftsModule } from '../shifts/shifts.module';

/**
 * Libur Module — employee monthly off-day quotas + requests
 */
@Module({
  imports: [ShiftsModule],
  controllers: [LiburController],
  providers: [LiburService, PrismaService],
  exports: [LiburService],
})
export class LiburModule {}
