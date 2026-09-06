import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { MutasiController } from './mutasi.controller';
import { MutasiService } from './mutasi.service';

@Module({
  providers: [PrismaService, MutasiService],
  controllers: [MutasiController],
  exports: [MutasiService],
})
export class MutasiModule {}
