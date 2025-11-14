import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService, PasswordService } from '../../shared/services';
import { AuthModule } from '../auth/auth.module';

/**
 * Users Module
 * Handles user management operations
 */
@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService, PrismaService, PasswordService],
  exports: [UsersService],
})
export class UsersModule {}
