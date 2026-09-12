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
import { WarehousesModule } from "./modules/warehouses/warehouses.module";
import { CustomerTypesModule } from "./modules/customer-types/customer-types.module";
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
import { CustomerTiersModule } from './modules/customer-tiers/customer-tiers.module';
import { PaymentTermsModule } from './modules/payment-terms/payment-terms.module';
import { ServiceCheckpointsModule } from './modules/service-checkpoints/service-checkpoints.module';
import { DeviceTypesModule } from './modules/device-types/device-types.module';
import { PosModule } from './modules/pos/pos.module';
import { StockRequestsModule } from './modules/stock-requests/stock-requests.module';
import { StockInModule } from './modules/stock-in/stock-in.module';
import { StockOutModule } from './modules/stock-out/stock-out.module';
import { TransferStockModule } from './modules/transfer-stock/transfer-stock.module';
import { MutasiModule } from './modules/mutasi/mutasi.module';
import { ApprovalSettingsModule } from './modules/approval-settings/approval-settings.module';
import { LabelPrintingModule } from './modules/label-printing/label-printing.module';
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
    WarehousesModule,
    CustomerTypesModule,
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
    CustomerTiersModule,
    PaymentTermsModule,
    ServiceCheckpointsModule,
    DeviceTypesModule,
    PosModule,
    StockRequestsModule,
    StockInModule,
    StockOutModule,
    TransferStockModule,
    MutasiModule,
    ApprovalSettingsModule,
    LabelPrintingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
