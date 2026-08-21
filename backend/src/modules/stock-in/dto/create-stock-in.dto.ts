import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Stock In line item DTO.
 * quantity must be > 0; stockValue is optional and defaults server-side
 * to Product.minSellingPrice (Harga Jual Minimum) when omitted.
 */
export class StockInItemDto {
  // NOTE: plain @IsUUID() (not version 4) — the live DB contains legacy
  // non-v4 UUIDs (e.g. Kalisat warehouse 690c292c-5548-1076-1145-...)
  @IsUUID(undefined, { message: 'Product ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Product ID is required' })
  productId!: string;

  @IsNumber({}, { message: 'Quantity must be a number' })
  @Min(0.001, { message: 'Quantity must be greater than zero' })
  quantity!: number;

  @IsUUID(undefined, { message: 'Unit ID must be a valid UUID' })
  @IsOptional()
  unitId?: string;

  @IsNumber({}, { message: 'Stock value must be a number' })
  @Min(0, { message: 'Stock value must be greater than or equal to 0' })
  @IsOptional()
  stockValue?: number;
}

/**
 * Create Stock In document DTO.
 * supplierId is either a real supplier (Customer wholesale) UUID or the
 * explicit 'NO_SUPPLIER' sentinel.
 */
export class CreateStockInDto {
  // NOTE: plain @IsUUID() (not version 4) — the live DB contains legacy
  // non-v4 UUIDs (e.g. Kalisat warehouse 690c292c-5548-1076-1145-...)
  @IsUUID(undefined, { message: 'Outlet ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Outlet is required' })
  outletId!: string;

  @IsUUID(undefined, { message: 'Warehouse ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Warehouse is required' })
  warehouseId!: string;

  @IsString({ message: 'Supplier must be a string' })
  @IsOptional()
  supplierId?: string;

  @IsDateString({}, { message: 'Date must be a valid ISO date' })
  @IsOptional()
  date?: string;

  @IsString({ message: 'Reason must be a string' })
  @IsNotEmpty({ message: 'Reason is required' })
  reason!: string;

  @IsArray({ message: 'Items must be an array' })
  @ValidateNested({ each: true })
  @Type(() => StockInItemDto)
  items!: StockInItemDto[];
}
