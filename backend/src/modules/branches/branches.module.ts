import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

@Module({
  providers: [PrismaService, BranchesService],
  controllers: [BranchesController],
  exports: [BranchesService],
})
export class BranchesModule {}

