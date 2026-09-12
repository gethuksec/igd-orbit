import { Module, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { ApprovalSettingsModule } from '../approval-settings/approval-settings.module';
import { LabelPrintingModule } from '../label-printing/label-printing.module';
import { PurchaseOrdersService } from './services/purchase-orders.service';
import { GoodsReceiptsService } from './services/goods-receipts.service';
import { PurchaseAttachmentsService } from './services/purchase-attachments.service';
import { PurchaseReturnsService } from './services/purchase-returns.service';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { GoodsReceiptsController } from './goods-receipts.controller';
import { PurchaseAttachmentsController } from './purchase-attachments.controller';
import { PurchaseReturnsController } from './purchase-returns.controller';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    forwardRef(() => FinanceModule), // For journal entries integration
    ApprovalSettingsModule,
    LabelPrintingModule,
  ],
  providers: [PrismaService, PurchaseOrdersService, GoodsReceiptsService, PurchaseAttachmentsService, PurchaseReturnsService],
  controllers: [PurchaseOrdersController, GoodsReceiptsController, PurchaseAttachmentsController, PurchaseReturnsController],
  exports: [PurchaseOrdersService, GoodsReceiptsService, PurchaseAttachmentsService, PurchaseReturnsService],
})
export class PurchasingModule {}

