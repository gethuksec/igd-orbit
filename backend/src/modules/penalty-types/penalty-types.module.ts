import { Module } from '@nestjs/common';
import { PenaltyTypesController } from './penalty-types.controller';
import { PenaltyTypesService } from './penalty-types.service';
import { PrismaService } from '../../shared/services';

/**
 * Penalty Types Module (IGDERP-261)
 */
@Module({
  controllers: [PenaltyTypesController],
  providers: [PenaltyTypesService, PrismaService],
  exports: [PenaltyTypesService],
})
export class PenaltyTypesModule {}
