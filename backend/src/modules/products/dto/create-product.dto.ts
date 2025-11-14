import {
  IsOptional,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsNumber,
  Min,
  Max,
  IsBoolean,
  IsObject,
  IsArray,
} from 'class-validator';

/**
 * Create Product DTO
 * Validates product creation request payload
 */
export class CreateProductDto {
  @IsString({ message: 'Barcode must be a string' })
  @IsOptional()
  barcode?: string;

  @IsString({ message: 'SKU must be a string' })
  @IsOptional()
  sku?: string; // Auto-generate if not provided

  @IsString({ message: 'Product name must be a string' })
  @IsNotEmpty({ message: 'Product name is required' })
  name!: string;

  @IsString({ message: 'Printed name must be a string' })
  @IsOptional()
  printedName?: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsUUID('4', { message: 'Category ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Category ID is required' })
  categoryId!: string;

  @IsUUID('4', { message: 'Brand ID must be a valid UUID' })
  @IsOptional()
  brandId?: string;

  @IsString({ message: 'Unit must be a string' })
  @IsOptional()
  unit?: string; // Default: 'pcs'

  @IsNumber({}, { message: 'Cost price must be a number' })
  @Min(0, { message: 'Cost price must be greater than or equal to 0' })
  @IsNotEmpty({ message: 'Cost price is required' })
  costPrice!: number;

  @IsNumber({}, { message: 'Selling price must be a number' })
  @Min(0, { message: 'Selling price must be greater than or equal to 0' })
  @IsNotEmpty({ message: 'Selling price is required' })
  sellingPrice!: number;

  @IsNumber({}, { message: 'Discount percentage must be a number' })
  @Min(0, { message: 'Discount percentage must be greater than or equal to 0' })
  @Max(100, { message: 'Discount percentage must be less than or equal to 100' })
  @IsOptional()
  discountPercentage?: number;

  @IsString({ message: 'Size must be a string' })
  @IsOptional()
  size?: string;

  @IsString({ message: 'Color must be a string' })
  @IsOptional()
  color?: string;

  @IsNumber({}, { message: 'Weight must be a number' })
  @Min(0, { message: 'Weight must be greater than or equal to 0' })
  @IsOptional()
  weightGrams?: number;

  @IsBoolean({ message: 'isService must be a boolean' })
  @IsNotEmpty({ message: 'isService is required' })
  isService!: boolean;

  @IsBoolean({ message: 'trackSerial must be a boolean' })
  @IsOptional()
  trackSerial?: boolean = false;

  @IsBoolean({ message: 'trackBatch must be a boolean' })
  @IsOptional()
  trackBatch?: boolean = false;

  @IsObject({ message: 'Member pricing must be an object' })
  @IsOptional()
  memberPricing?: Record<string, any>; // JSON object

  @IsArray({ message: 'Images must be an array' })
  @IsString({ each: true, message: 'Each image must be a string URL' })
  @IsOptional()
  images?: string[];

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean = true;
}

