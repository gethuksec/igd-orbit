import { Module } from '@nestjs/common';
import { StockRequestsController } from './stock-requests.controller';
import { StockRequestsService } from './stock-requests.service';
import { PrismaService } from '../../shared/services';

@Module({
  controllers: [StockRequestsController],
  providers: [StockRequestsService, PrismaService],
  exports: [StockRequestsService],
})
export class StockRequestsModule {}
