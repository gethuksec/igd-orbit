import { Module } from '@nestjs/common';
import { ExpeditionsController } from './expeditions.controller';
import { ExpeditionsService } from './expeditions.service';
import { PrismaService } from '../../shared/services';
@Module({ controllers: [ExpeditionsController], providers: [ExpeditionsService, PrismaService], exports: [ExpeditionsService] })
export class ExpeditionsModule {}
