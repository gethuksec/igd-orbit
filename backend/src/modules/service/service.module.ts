import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { ServiceOrdersService } from './service-orders.service';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceTypesService } from './service-types.service';
import { ServiceTypesController } from './service-types.controller';
import { ServiceReturnsService } from './service-returns.service';
import { ServiceReturnsController } from './service-returns.controller';
import { FinanceModule } from '../finance/finance.module';
import { SalesModule } from '../sales/sales.module';
import { ApprovalSettingsModule } from '../approval-settings/approval-settings.module';

@Module({
  imports: [FinanceModule, SalesModule, ApprovalSettingsModule],
  providers: [PrismaService, ServiceOrdersService, ServiceTypesService, ServiceReturnsService],
  controllers: [ServiceOrdersController, ServiceTypesController, ServiceReturnsController],
  exports: [ServiceOrdersService, ServiceTypesService, ServiceReturnsService],
})
export class ServiceModule {}



