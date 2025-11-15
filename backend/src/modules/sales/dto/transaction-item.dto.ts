import {
  IsUUID,
  IsInt,
  Min,
  Max,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Transaction Item DTO
 * Validates transaction item data
 */
export class TransactionItemDto {
  @IsUUID('4', { message: 'Product ID must be a valid UUID' })
  productId!: string;

  @IsInt({ message: 'Quantity must be an integer' })
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity!: number;

  @IsNumber({}, { message: 'Unit price must be a number' })
  @Min(0, { message: 'Unit price must be greater than or equal to 0' })
  unitPrice!: number;

  @IsNumber({}, { message: 'Discount percentage must be a number' })
  @Min(0, { message: 'Discount percentage must be greater than or equal to 0' })
  @Max(100, { message: 'Discount percentage must be less than or equal to 100' })
  @IsOptional()
  discountPercentage?: number;

  @IsNumber({}, { message: 'Discount amount must be a number' })
  @Min(0, { message: 'Discount amount must be greater than or equal to 0' })
  @IsOptional()
  discountAmount?: number;

  @IsString({ message: 'Batch number must be a string' })
  @IsOptional()
  batchNumber?: string;

  @IsString({ message: 'Serial number must be a string' })
  @IsOptional()
  serialNumber?: string;

  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;
}

