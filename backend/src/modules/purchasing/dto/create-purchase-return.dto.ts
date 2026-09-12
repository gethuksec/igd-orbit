import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** IGDERP-84: one returned line. `unit_price` is used in manual mode only (no PO). */
export class CreatePurchaseReturnItemDto {
  @IsUUID()
  product_id!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unit_price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/**
 * IGDERP-84: purchase return per supplier invoice.
 * Two modes:
 *  - PO mode:    purchase_order_id provided → lines capped at received − already returned,
 *                unit price snapshotted from the PO.
 *  - Manual mode (first-deploy / pre-system invoices): supplier_id + invoice_number +
 *                manual unit prices; no PO link, no cap (limited by central-good stock).
 */
export class CreatePurchaseReturnDto {
  @IsOptional()
  @IsUUID()
  purchase_order_id?: string;

  @IsOptional()
  @IsUUID()
  supplier_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  invoice_number?: string;

  @IsString()
  @IsNotEmpty({ message: 'Alasan retur wajib diisi' })
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnItemDto)
  items!: CreatePurchaseReturnItemDto[];
}
