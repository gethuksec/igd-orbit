import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { ServiceModule } from '../service/service.module';
import { PrismaService } from '../../shared/services/prisma.service';

@Module({
  imports: [ServiceModule],
  controllers: [PublicController],
  providers: [PrismaService],
})
export class PublicModule {}

