import { Module } from "@nestjs/common";
import { CustomerTiersController } from "./customer-tiers.controller";
import { CustomerTiersService } from "./customer-tiers.service";
import { PrismaService } from "../../shared/services";

/**
 * CustomerTiers Module
 * Handles customer tier management operations
 */
@Module({
  controllers: [CustomerTiersController],
  providers: [CustomerTiersService, PrismaService],
  exports: [CustomerTiersService],
})
export class CustomerTiersModule {}
