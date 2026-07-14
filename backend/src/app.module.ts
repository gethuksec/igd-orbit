import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { appConfig, databaseConfig, redisConfig, jwtConfig } from './config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BrandsModule } from './modules/brands/brands.module';
import { ColorsModule } from "./modules/colors/colors.module";
import { UnitsModule } from "./modules/units/units.module";
import { SizesModule } from "./modules/sizes/sizes.module";
import { ExpeditionsModule } from "./modules/expeditions/expeditions.module";
import { SalesTypesModule } from "./modules/sales-types/sales-types.module";
import { CustomersModule } from './modules/customers/customers.module';
import { SalesModule } from './modules/sales/sales.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { ServiceModule } from './modules/service/service.module';
import { BranchesModule } from './modules/branches/branches.module';
import { PublicModule } from './modules/public/public.module';
import { FinanceModule } from './modules/finance/finance.module';
import { HRModule } from './modules/hr/hr.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { PurchasingModule } from './modules/purchasing/purchasing.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { RolesModule } from './modules/roles/roles.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { CustomerTiersModule } from './modules/customer-tiers/customer-tiers.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    BrandsModule,
    ColorsModule,
    UnitsModule,
    SizesModule,
    ExpeditionsModule,
    SalesTypesModule,
    CustomersModule,
    SuppliersModule,
    SalesModule,
    InventoryModule,
    ServiceModule,
    BranchesModule,
    PublicModule,
    FinanceModule,
    HRModule,
    PurchasingModule,
    DashboardModule,
    WebSocketModule,
    RolesModule,
    PermissionsModule,
    CustomerTiersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
