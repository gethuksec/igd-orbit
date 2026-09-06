import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { ApprovalSettingsController } from './approval-settings.controller';
import { ApprovalSettingsService } from './approval-settings.service';

@Module({
  providers: [PrismaService, ApprovalSettingsService],
  controllers: [ApprovalSettingsController],
  exports: [ApprovalSettingsService],
})
export class ApprovalSettingsModule {}
