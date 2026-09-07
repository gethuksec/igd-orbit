import { Module, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { ApprovalSettingsModule } from '../approval-settings/approval-settings.module';
import { PurchaseOrdersService } from './services/purchase-orders.service';
import { GoodsReceiptsService } from './services/goods-receipts.service';
import { PurchaseAttachmentsService } from './services/purchase-attachments.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { GoodsReceiptsController } from './goods-receipts.controller';
import { PurchaseAttachmentsController } from './purchase-attachments.controller';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    forwardRef(() => FinanceModule), // For journal entries integration
    ApprovalSettingsModule,
  ],
  providers: [PrismaService, PurchaseOrdersService, GoodsReceiptsService, PurchaseAttachmentsService],
  controllers: [PurchaseOrdersController, GoodsReceiptsController, PurchaseAttachmentsController],
  exports: [PurchaseOrdersService, GoodsReceiptsService, PurchaseAttachmentsService],
})
export class PurchasingModule {}

