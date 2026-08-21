import {
  IsUUID,
  IsEnum,
  IsInt,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  Min,
} from 'class-validator';

export class StockAdjustmentDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string; // Legacy fallback: resolves to the outlet's default GOOD warehouse

  @IsEnum(['IN', 'OUT', 'DAMAGE', 'FOUND', 'CORRECTION'])
  type!: 'IN' | 'OUT' | 'DAMAGE' | 'FOUND' | 'CORRECTION';

  @IsInt()
  @Min(1)
  quantityChange!: number; // Positive or negative

  @IsNumber()
  @IsOptional()
  @Min(0)
  unitCost?: number;

  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  notes?: string;

  @IsOptional()
  batchNumber?: string;

  @IsOptional()
  serialNumber?: string;
}

