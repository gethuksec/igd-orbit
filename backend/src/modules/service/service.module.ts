import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { ServiceOrdersService } from './service-orders.service';
import { ServiceOrdersController } from './service-orders.controller';
import { ServiceTypesService } from './service-types.service';
import { ServiceTypesController } from './service-types.controller';

@Module({
  providers: [PrismaService, ServiceOrdersService, ServiceTypesService],
  controllers: [ServiceOrdersController, ServiceTypesController],
  exports: [ServiceOrdersService, ServiceTypesService],
})
export class ServiceModule {}



