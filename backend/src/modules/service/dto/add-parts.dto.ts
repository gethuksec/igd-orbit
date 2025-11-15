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
}

export class AddPartsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServicePartDto)
  parts!: ServicePartDto[];
}



