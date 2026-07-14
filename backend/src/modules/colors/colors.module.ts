import { Module } from '@nestjs/common';
import { ColorsController } from './colors.controller';
import { ColorsService } from './colors.service';
import { PrismaService } from '../../shared/services';

/**
 * Colors Module
 * Handles color management operations
 */
@Module({
  controllers: [ColorsController],
  providers: [ColorsService, PrismaService],
  exports: [ColorsService],
})
export class ColorsModule {}
