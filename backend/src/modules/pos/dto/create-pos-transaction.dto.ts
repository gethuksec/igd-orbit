import {
  IsEnum,
  IsUUID,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  Max,
  IsString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PosTransactionItemDto {
  @IsUUID('4', { message: 'Product ID must be a valid UUID' })
  productId!: string;

  @IsNumber({}, { message: 'Quantity must be a number' })
  @Min(0, { message: 'Quantity must be positive' })
  quantity!: number;

  @IsNumber({}, { message: 'Unit price must be a number' })
  @Min(0, { message: 'Unit price must be positive' })
  unitPrice!: number;

  @IsNumber({}, { message: 'Discount must be a number' })
  @Min(0)
  @IsOptional()
  discountAmount?: number;
}

export class PosPaymentDto {
  @IsEnum(['cash', 'card', 'transfer', 'e-wallet', 'credit', 'deposit'], {
    message: 'Invalid payment method',
  })
  method!: string;

  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0)
  amount!: number;

  @IsOptional()
  details?: Record<string, any>;
}

export class CreatePosTransactionDto {
  @IsUUID('4', { message: 'Branch ID must be a valid UUID' })
  branchId!: string;

  @IsUUID('4', { message: 'Customer ID must be a valid UUID' })
  @IsOptional()
  customerId?: string;

  @IsUUID('4', { message: 'Payment term ID must be a valid UUID' })
  @IsOptional()
  paymentTermId?: string;

  @IsUUID('4', { message: 'Sales person ID must be a valid UUID' })
  @IsOptional()
  salesPersonId?: string;

  @IsUUID('4', { message: 'Warehouse ID must be a valid UUID' })
  @IsOptional()
  warehouseId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosTransactionItemDto)
  items!: PosTransactionItemDto[];

  @IsNumber({})
  @Min(0)
  @Max(100)
  @IsOptional()
  discountPercentage?: number;

  @IsNumber({})
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsNumber({})
  @Min(0)
  @Max(100)
  @IsOptional()
  taxPercentage?: number;

  // T21: sales type (Tipe Penjualan) + draft status
  @IsString()
  @IsOptional()
  salesTypeId?: string;

  @IsIn(['pending', 'held', 'completed'])
  @IsOptional()
  status?: string;

  @ValidateNested()
  @Type(() => PosPaymentDto)
  @IsOptional()
  payment?: PosPaymentDto;

  @IsString()
  @IsOptional()
  receiptNotes?: string;

  @IsString()
  @IsOptional()
  internalNotes?: string;

  @IsString()
  @IsOptional()
  keterangan?: string;
}
