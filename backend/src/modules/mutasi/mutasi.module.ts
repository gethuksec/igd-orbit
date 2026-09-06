import { Module } from '@nestjs/common';
import { MutasiController } from './mutasi.controller';
import { MutasiService } from './mutasi.service';

@Module({
  controllers: [MutasiController],
  providers: [MutasiService],
  exports: [MutasiService],
})
export class MutasiModule {}
