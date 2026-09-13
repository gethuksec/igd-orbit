import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/** UUID format regardless of version — the live DB has legacy non-v4 ids. */
const ANY_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * IGDERP-97 (I4) — one validated preview row for import confirm.
 * productId/quantity come from the preview step (SKU/barcode already
 * resolved); confirm re-checks existence + availability server-side.
 */
export class ConfirmImportRowDto {
  @Matches(ANY_UUID, { message: 'Product ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Product ID is required' })
  productId!: string;

  @IsNumber({}, { message: 'Quantity must be a number' })
  @Min(0.001, { message: 'Quantity must be greater than zero' })
  quantity!: number;

  @IsNumber({}, { message: 'Stock value must be a number' })
  @Min(0, { message: 'Stock value must be greater than or equal to 0' })
  @IsOptional()
  stockValue?: number;

  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;
}

/**
 * Confirm a previewed Stock In import.
 * mode TAMBAH adds to current stock (same path as the manual form);
 * mode REPLACE sets each listed SKU to the file quantity.
 */
export class ConfirmImportDto {
  @Matches(ANY_UUID, { message: 'Outlet ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Outlet is required' })
  outletId!: string;

  @Matches(ANY_UUID, { message: 'Warehouse ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Warehouse is required' })
  warehouseId!: string;

  @IsIn(['TAMBAH', 'REPLACE'], { message: 'Mode must be TAMBAH or REPLACE' })
  mode!: 'TAMBAH' | 'REPLACE';

  @IsString({ message: 'File name must be a string' })
  @IsNotEmpty({ message: 'File name is required' })
  fileName!: string;

  @IsString({ message: 'Reason must be a string' })
  @IsOptional()
  reason?: string;

  @IsArray({ message: 'Rows must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ConfirmImportRowDto)
  rows!: ConfirmImportRowDto[];
}
