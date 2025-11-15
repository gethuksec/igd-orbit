import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { BranchesController } from './branches.controller';

@Module({
  providers: [PrismaService],
  controllers: [BranchesController],
  exports: [PrismaService],
})
export class BranchesModule {}

