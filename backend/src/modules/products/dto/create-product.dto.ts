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
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

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

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @ValidateIf((o) => o.subCategoryId !== undefined && o.subCategoryId !== null)
  @IsUUID('4', { message: 'Sub Category ID must be a valid UUID' })
  subCategoryId?: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @ValidateIf((o) => o.brandId !== undefined && o.brandId !== null)
  @IsUUID('4', { message: 'Brand ID must be a valid UUID' })
  brandId?: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @ValidateIf((o) => o.supplierId !== undefined && o.supplierId !== null)
  @IsUUID('4', { message: 'Supplier ID must be a valid UUID' })
  supplierId?: string;

  @IsUUID('4', { message: 'Unit ID must be a valid UUID' })
  @IsOptional()
  unitId?: string;

  @IsNumber({}, { message: 'Cost price must be a number' })
  @Min(0, { message: 'Cost price must be greater than or equal to 0' })
  @IsNotEmpty({ message: 'Cost price is required' })
  costPrice!: number;

  @IsNumber({}, { message: 'Selling price must be a number' })
  @Min(0, { message: 'Selling price must be greater than or equal to 0' })
  @IsNotEmpty({ message: 'Selling price is required' })
  sellingPrice!: number;

  @IsNumber({}, { message: 'Minimum selling price must be a number' })
  @Min(0, { message: 'Minimum selling price must be greater than or equal to 0' })
  @IsOptional()
  minSellingPrice?: number;

  @IsNumber({}, { message: 'Discount percentage must be a number' })
  @Min(0, { message: 'Discount percentage must be greater than or equal to 0' })
  @Max(100, { message: 'Discount percentage must be less than or equal to 100' })
  @IsOptional()
  discountPercentage?: number;

  @IsUUID('4', { message: 'Size ID must be a valid UUID' })
  @IsOptional()
  sizeId?: string;

  @IsUUID('4', { message: 'Color ID must be a valid UUID' })
  @IsOptional()
  colorId?: string;

  @IsNumber({}, { message: 'Length must be a number' })
  @Min(0, { message: 'Length must be greater than or equal to 0' })
  @IsOptional()
  lengthCm?: number;

  @IsNumber({}, { message: 'Width must be a number' })
  @Min(0, { message: 'Width must be greater than or equal to 0' })
  @IsOptional()
  widthCm?: number;

  @IsNumber({}, { message: 'Height must be a number' })
  @Min(0, { message: 'Height must be greater than or equal to 0' })
  @IsOptional()
  heightCm?: number;

  @IsNumber({}, { message: 'Weight must be a number' })
  @Min(0, { message: 'Weight must be greater than or equal to 0' })
  @IsOptional()
  weightGrams?: number;

  @IsNumber({}, { message: 'Package weight must be a number' })
  @Min(0, { message: 'Package weight must be greater than or equal to 0' })
  @IsOptional()
  packageWeightGrams?: number;

  @IsBoolean({ message: 'isService must be a boolean' })
  @IsOptional()
  isService?: boolean = false;

  @IsBoolean({ message: 'trackSerial must be a boolean' })
  @IsOptional()
  trackSerial?: boolean = false;

  @IsBoolean({ message: 'trackBatch must be a boolean' })
  @IsOptional()
  trackBatch?: boolean = false;

  @IsBoolean({ message: 'trackExpiry must be a boolean' })
  @IsOptional()
  trackExpiry?: boolean = false;

  @IsNumber({}, { message: 'Expiry return limit days must be a number' })
  @Min(0, { message: 'Expiry return limit days must be greater than or equal to 0' })
  @IsOptional()
  expiryReturnLimitDays?: number;

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

