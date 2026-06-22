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
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionItemDto } from './transaction-item.dto';
import { PaymentDto } from './payment.dto';

/**
 * Create Sales Transaction DTO
 * Validates sales transaction creation request payload
 */
export class CreateSalesTransactionDto {
  @IsEnum(['pos', 'order', 'pre-order'], {
    message: 'Transaction type must be one of: pos, order, pre-order',
  })
  transactionType!: string;

  @IsUUID('4', { message: 'Customer ID must be a valid UUID' })
  @IsOptional()
  customerId?: string;

  @IsUUID('4', { message: 'Branch ID must be a valid UUID' })
  branchId!: string;

  @IsArray({ message: 'Items must be an array' })
  @ValidateNested({ each: true })
  @Type(() => TransactionItemDto)
  items!: TransactionItemDto[];

  @IsNumber({}, { message: 'Discount percentage must be a number' })
  @Min(0, { message: 'Discount percentage must be greater than or equal to 0' })
  @Max(100, { message: 'Discount percentage must be less than or equal to 100' })
  @IsOptional()
  discountPercentage?: number;

  @IsNumber({}, { message: 'Discount amount must be a number' })
  @Min(0, { message: 'Discount amount must be greater than or equal to 0' })
  @IsOptional()
  discountAmount?: number;

  @IsNumber({}, { message: 'Tax percentage must be a number' })
  @Min(0, { message: 'Tax percentage must be greater than or equal to 0' })
  @IsOptional()
  taxPercentage?: number = 11;

  @ValidateNested()
  @Type(() => PaymentDto)
  payment!: PaymentDto;

  @IsString({ message: "Receipt notes must be a string" })
  @IsOptional()
  receiptNotes?: string;

  @IsString({ message: "Internal notes must be a string" })
  @IsOptional()
  internalNotes?: string;
}

