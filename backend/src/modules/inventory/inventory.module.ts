import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { StockTransferService } from './stock-transfer.service';
import { StockTransferController } from './stock-transfer.controller';
import { StockOpnameService } from './stock-opname.service';
import { StockOpnameController } from './stock-opname.controller';

@Module({
  providers: [PrismaService, StockService, StockTransferService, StockOpnameService],
  controllers: [StockController, StockTransferController, StockOpnameController],
  exports: [StockService, StockTransferService, StockOpnameService],
})
export class InventoryModule {}

