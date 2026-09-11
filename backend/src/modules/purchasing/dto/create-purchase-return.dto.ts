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

/** IGDERP-84: one returned line (qty capped at received − already returned). */
export class CreatePurchaseReturnItemDto {
  @IsUUID()
  product_id!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** IGDERP-84: purchase return per supplier invoice (1 invoice = 1 return). */
export class CreatePurchaseReturnDto {
  @IsUUID()
  purchase_order_id!: string;

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
