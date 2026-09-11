import {
  IsDateString,
  IsOptional,
  IsString,
  IsInt,
  Min,
  IsNumber,
  IsArray,
  ValidateNested,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePurchaseOrderItemDto } from './create-purchase-order.dto';

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @ValidateIf((o) => o.expected_delivery_date !== '' && o.expected_delivery_date !== null)
  @IsDateString()
  expected_delivery_date?: string;

  @IsString()
  @IsOptional()
  payment_terms?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  payment_term_days?: number;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  invoice_number?: string;

  @IsDateString()
  @IsOptional()
  invoice_date?: string;

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
  @IsOptional()
  items?: CreatePurchaseOrderItemDto[];
}

