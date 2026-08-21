import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockOutService } from './stock-out.service';
import { StockOutController } from './stock-out.controller';

@Module({
  providers: [PrismaService, StockOutService],
  controllers: [StockOutController],
  exports: [StockOutService],
})
export class StockOutModule {}
