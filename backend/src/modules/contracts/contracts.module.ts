import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { PasswordService } from '../../shared/services/password.service';
import { ContractsService } from './services/contracts.service';
import { ContractsImportService } from './services/contracts-import.service';
import { ContractsController } from './contracts.controller';

@Module({
  controllers: [ContractsController],
  providers: [PrismaService, PasswordService, ContractsService, ContractsImportService],
  exports: [ContractsService, ContractsImportService],
})
export class ContractsModule {}
