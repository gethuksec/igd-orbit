import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma Service for database access
 * Provides singleton Prisma Client instance
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * Initialize Prisma Client connection
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * Disconnect Prisma Client on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
