import { Module } from '@nestjs/common';
import { SizesController } from './sizes.controller';
import { SizesService } from './sizes.service';
import { PrismaService } from '../../shared/services';

/**
 * Sizes Module
 * Handles size management operations
 */
@Module({
  controllers: [SizesController],
  providers: [SizesService, PrismaService],
  exports: [SizesService],
})
export class SizesModule {}
