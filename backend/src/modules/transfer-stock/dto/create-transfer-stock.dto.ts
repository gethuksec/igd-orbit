import {
  IsArray,
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
 * Transfer line item DTO. Quantity-only — transfer carries no price or GL value.
 */
export class TransferStockItemDto {
  @Matches(ANY_UUID, { message: 'Product ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Product ID is required' })
  productId!: string;

  @IsNumber({}, { message: 'Quantity must be a number' })
  @Min(0.001, { message: 'Quantity must be greater than zero' })
  quantity!: number;
}

/**
 * Create Transfer Stock (v2) document DTO — INTRA-OUTLET movement only.
 *
 * Per 27 Aug §9 decision (menu split, IGDERP-139):
 * Transfer Stock = warehouse ↔ warehouse WITHIN the same outlet
 * (e.g., Gudang Service ↔ Gudang Penjualan), operated by ASA
 * (permission key inventory.transfer).
 *
 * Moves that cross the central warehouse (central-good/central-bad ↔ outlet)
 * or go outlet ↔ outlet are NOT transfer — they are Mutasi (IGDERP-140).
 *
 * Source and destination are both GOOD/OUTLET warehouses of the SAME outlet;
 * destination must differ from the source. Quantity-only, atomic OUT/IN,
 * no GL.
 */
export class CreateTransferStockDto {
  @Matches(ANY_UUID, { message: 'Source outlet ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Source outlet is required' })
  outletId!: string;

  @Matches(ANY_UUID, { message: 'Source warehouse ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Source warehouse is required' })
  warehouseId!: string;

  @Matches(ANY_UUID, { message: 'Destination warehouse ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Destination warehouse is required' })
  toWarehouseId!: string;

  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;

  @IsArray({ message: 'Items must be an array' })
  @ValidateNested({ each: true })
  @Type(() => TransferStockItemDto)
  items!: TransferStockItemDto[];
}
