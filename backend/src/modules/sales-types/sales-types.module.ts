import { Module } from '@nestjs/common';
import { SalesTypesController } from './sales-types.controller';
import { SalesTypesService } from './sales-types.service';
import { PrismaService } from '../../shared/services';
@Module({ controllers: [SalesTypesController], providers: [SalesTypesService, PrismaService], exports: [SalesTypesService] })
export class SalesTypesModule {}
