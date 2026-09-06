import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransferStockItemDto } from '../../transfer-stock/dto/create-transfer-stock.dto';

/** UUID format regardless of version — the live DB has legacy non-v4 ids
 * (e.g. Kalisat warehouse 690c292c-5548-1076-1145-...), which class-validator's
 * @IsUUID() rejects even with 'all'. */
const ANY_UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Create Mutasi document DTO — CENTRAL ↔ OUTLET movement.
 *
 * Per 27 Aug §9 decision (menu split, IGDERP-140):
 * Mutasi = central-good / central-bad ↔ outlet warehouse, PLUS outlet ↔ outlet
 * (the old IGDERP-78 inter-outlet mode, renamed under Mutasi), operated by
 * SODO (permission key inventory.mutasi).
 *
 * Valid combinations (validated server-side against warehouse scope/type):
 *  - SYSTEM (GOOD|BAD) ↔ OUTLET/GOOD — either direction
 *  - OUTLET/GOOD ↔ OUTLET/GOOD — only when the outlets differ
 * Rejected: same warehouse, SYSTEM ↔ SYSTEM (no central-to-central moves),
 * OUTLET ↔ OUTLET of the same outlet (that is Transfer, IGDERP-139).
 *
 * Quantity-only, atomic OUT/IN, StockMovement rows, no GL.
 */
export class CreateMutasiDto {
  @Matches(ANY_UUID, { message: 'Source warehouse ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Source warehouse is required' })
  fromWarehouseId!: string;

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
