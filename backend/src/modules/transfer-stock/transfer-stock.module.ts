import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { TransferStockService } from './transfer-stock.service';
import { TransferStockController } from './transfer-stock.controller';

@Module({
  providers: [PrismaService, TransferStockService],
  controllers: [TransferStockController],
  exports: [TransferStockService],
})
export class TransferStockModule {}
