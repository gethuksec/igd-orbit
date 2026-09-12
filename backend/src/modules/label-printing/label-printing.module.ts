import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { LabelPrintingService } from './label-printing.service';
import { LabelPrintingController } from './label-printing.controller';

@Module({
  providers: [PrismaService, LabelPrintingService],
  controllers: [LabelPrintingController],
  exports: [LabelPrintingService],
})
export class LabelPrintingModule {}
