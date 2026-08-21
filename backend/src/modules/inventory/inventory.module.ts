import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { StockOpnameService } from './stock-opname.service';
import { StockOpnameController } from './stock-opname.controller';

@Module({
  providers: [PrismaService, StockService, StockOpnameService],
  controllers: [StockController, StockOpnameController],
  exports: [StockService, StockOpnameService],
})
export class InventoryModule {}
