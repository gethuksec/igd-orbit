import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockInService } from './stock-in.service';
import { StockInController } from './stock-in.controller';

@Module({
  providers: [PrismaService, StockInService],
  controllers: [StockInController],
  exports: [StockInService],
})
export class StockInModule {}
