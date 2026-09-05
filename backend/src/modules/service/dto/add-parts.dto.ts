import {
  IsArray,
  IsUUID,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ServicePartDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number; // Price charged to customer

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  warrantyDays?: number; // Garansi in days (IGDERP-138; autofill from product, editable)

  // IGDERP-136 round 2: source gudang per part (cross-gudang cross-selling); omitted = order warehouse.
  // NOTE: @IsString (not @IsUUID) — warehouse ids are TEXT, not all RFC UUIDs.
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsString()
  @IsOptional()
  purchaseType?: 'internal' | 'external'; // 'internal' = stok sendiri, 'external' = beli di luar
}

export class AddPartsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServicePartDto)
  parts!: ServicePartDto[];
}



