import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  IsDateString,
} from 'class-validator';

/** IGDERP-80: approver sends a GR back to the processor (SODO) with a reason. */
export class RevisitGoodsReceiptDto {
  @IsString()
  reason!: string;
}

export class ReceivingItemDto {
  @IsUUID()
  id!: string;

  @Type(() => Number)
  @Min(0)
  quantity_received!: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  quantity_rejected?: number;

  @IsOptional()
  @IsString()
  batch_number?: string;

  @IsOptional()
  @IsString()
  serial_number?: string;

  @IsOptional()
  @IsDateString()
  expiry_date?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

/** IGDERP-80: processor (SODO) updates per-item receiving quantities before/after approval. */
export class UpdateReceivingDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivingItemDto)
  items!: ReceivingItemDto[];
}
