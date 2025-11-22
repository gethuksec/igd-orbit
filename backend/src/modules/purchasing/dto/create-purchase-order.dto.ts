import {
  IsNotEmpty,
  IsUUID,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsOptional,
  IsString,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePurchaseOrderItemDto {
  @IsUUID()
  @IsNotEmpty()
  product_id!: string;

  @IsNumber()
  @Min(0.001)
  quantity_ordered!: number;

  @IsNumber()
  @Min(0)
  unit_price!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_percent?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  @IsNotEmpty()
  supplier_id!: string;

  @IsUUID()
  @IsNotEmpty()
  branch_id!: string;

  @IsDateString()
  order_date!: string;

  @IsDateString()
  @IsOptional()
  expected_delivery_date?: string;

  @IsString()
  @IsOptional()
  payment_terms?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  payment_term_days?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_amount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_amount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  shipping_cost?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items!: CreatePurchaseOrderItemDto[];
}

