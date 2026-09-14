import {
  IsUUID,
  IsEnum,
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListMovementsDto {
  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsUUID(undefined, { each: true })
  @IsOptional()
  branchIds?: string[];

  @IsEnum(['IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'])
  @IsOptional()
  movementType?: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';

  @IsString()
  @IsOptional()
  referenceType?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

