import { Module } from '@nestjs/common';
import { PaymentTermsController } from './payment-terms.controller';
import { PaymentTermsService } from './payment-terms.service';
import { PrismaService } from '../../shared/services';

/**
 * Payment Terms Module
 * Handles payment term master data
 */
@Module({
  controllers: [PaymentTermsController],
  providers: [PaymentTermsService, PrismaService],
  exports: [PaymentTermsService],
})
export class PaymentTermsModule {}
