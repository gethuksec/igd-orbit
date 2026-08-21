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
 * Create Transfer Stock document DTO.
 *
 * Source is always an outlet-owned GOOD warehouse (outletId + warehouseId).
 * Destination has two modes:
 *  - 'outlet': requires toOutletId + toWarehouseId, and the destination
 *    outlet must differ from the source outlet.
 *  - 'central_bad': no destination outlet/warehouse — the single
 *    system-scoped Central Bad Stock warehouse is resolved server-side.
 */
export class CreateTransferStockDto {
  @Matches(ANY_UUID, { message: 'Source outlet ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Source outlet is required' })
  outletId!: string;

  @Matches(ANY_UUID, { message: 'Source warehouse ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Source warehouse is required' })
  warehouseId!: string;

  @IsIn(['outlet', 'central_bad'], {
    message: 'Destination mode must be "outlet" or "central_bad"',
  })
  destinationMode!: 'outlet' | 'central_bad';

  @Matches(ANY_UUID, { message: 'Destination outlet ID must be a valid UUID' })
  @IsOptional()
  toOutletId?: string;

  @Matches(ANY_UUID, { message: 'Destination warehouse ID must be a valid UUID' })
  @IsOptional()
  toWarehouseId?: string;

  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;

  @IsArray({ message: 'Items must be an array' })
  @ValidateNested({ each: true })
  @Type(() => TransferStockItemDto)
  items!: TransferStockItemDto[];
}
