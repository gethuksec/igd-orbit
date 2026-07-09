import { Module } from '@nestjs/common';
import { ColorsController } from './colors.controller';
import { ColorsService } from './colors.service';
import { PrismaService } from '../../shared/services';
@Module({ controllers: [ColorsController], providers: [ColorsService, PrismaService], exports: [ColorsService] })
export class ColorsModule {}
