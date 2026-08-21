import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** UUID format regardless of version — the live DB has legacy non-v4 ids
 * (e.g. Kalisat warehouse 690c292c-5548-1076-1145-...), which class-validator's
 * @IsUUID() rejects even with 'all'. */
const ANY_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Stock Out line item DTO.
 * quantity must be > 0; stockValue is optional and defaults server-side
 * to Product.minSellingPrice (Harga Jual Minimum) when omitted.
 */
export class StockOutItemDto {
  @Matches(ANY_UUID, { message: 'Product ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Product ID is required' })
  productId!: string;

  @IsNumber({}, { message: 'Quantity must be a number' })
  @Min(0.001, { message: 'Quantity must be greater than zero' })
  quantity!: number;

  @Matches(ANY_UUID, { message: 'Unit ID must be a valid UUID' })
  @IsOptional()
  unitId?: string;

  @IsNumber({}, { message: 'Stock value must be a number' })
  @Min(0, { message: 'Stock value must be greater than or equal to 0' })
  @IsOptional()
  stockValue?: number;
}

/**
 * Create Stock Out document DTO.
 * outletId is optional: required when the source is an outlet-owned GOOD
 * warehouse, ignored/absent when the source is the system-scoped Central
 * Bad Stock warehouse (scope SYSTEM, type BAD).
 */
export class CreateStockOutDto {
  @Matches(ANY_UUID, { message: 'Outlet ID must be a valid UUID' })
  @IsOptional()
  outletId?: string;

  @Matches(ANY_UUID, { message: 'Warehouse ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Warehouse is required' })
  warehouseId!: string;

  @IsDateString({}, { message: 'Date must be a valid ISO date' })
  @IsOptional()
  date?: string;

  @IsString({ message: 'Reason must be a string' })
  @IsNotEmpty({ message: 'Reason is required' })
  reason!: string;

  @IsArray({ message: 'Items must be an array' })
  @ValidateNested({ each: true })
  @Type(() => StockOutItemDto)
  items!: StockOutItemDto[];
}
