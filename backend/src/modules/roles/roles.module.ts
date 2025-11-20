import { Module } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { PrismaService } from '../../shared/services';

/**
 * Roles Module
 * Handles role management operations
 */
@Module({
  controllers: [RolesController],
  providers: [RolesService, PrismaService],
  exports: [RolesService],
})
export class RolesModule {}

