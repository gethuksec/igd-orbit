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
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGoodsReceiptItemDto {
  @IsUUID()
  @IsOptional()
  purchase_order_item_id?: string; // Optional, can receive without PO

  @IsUUID()
  @IsNotEmpty()
  product_id!: string;

  @IsNumber()
  @Min(0.001)
  quantity_received!: number;

  @IsNumber()
  @Min(0)
  unit_price!: number;

  @IsString()
  @IsOptional()
  batch_number?: string;

  @IsString()
  @IsOptional()
  serial_number?: string;

  @IsDateString()
  @IsOptional()
  expiry_date?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateGoodsReceiptDto {
  @IsUUID()
  @IsOptional()
  purchase_order_id?: string; // Optional, can receive without PO

  @IsUUID()
  @IsNotEmpty()
  branch_id!: string;

  @IsDateString()
  receipt_date!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptItemDto)
  items!: CreateGoodsReceiptItemDto[];
}

