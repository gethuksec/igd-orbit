import { Module, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { PurchaseOrdersService } from './services/purchase-orders.service';
import { GoodsReceiptsService } from './services/goods-receipts.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { GoodsReceiptsController } from './goods-receipts.controller';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    forwardRef(() => FinanceModule), // For journal entries integration
  ],
  providers: [PrismaService, PurchaseOrdersService, GoodsReceiptsService],
  controllers: [PurchaseOrdersController, GoodsReceiptsController],
  exports: [PurchaseOrdersService, GoodsReceiptsService],
})
export class PurchasingModule {}

