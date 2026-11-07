import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * One resolved warehouse opening-stock line.
 */
export class ConfirmProductStockDto {
  @IsUUID('4', { message: 'Warehouse ID must be a valid UUID' })
  @IsNotEmpty()
  warehouseId!: string;

  @IsNumber({}, { message: 'Quantity must be a number' })
  @Min(0, { message: 'Quantity must be >= 0' })
  quantity!: number;
}

/**
 * One preview-resolved product row sent back for confirmation.
 * categoryId/brandId come from preview resolution; categoryName/brandName
 * carry the auto-create path (preview is read-only, so unknown
 * category/brand names are created here at confirm time).
 */
export class ConfirmProductImportRowDto {
  @IsArray({ message: 'rowNumbers must be an array' })
  @IsNumber({}, { each: true })
  rowNumbers!: number[];

  @IsString()
  @IsOptional()
  barcode?: string;

  @IsString()
  @IsNotEmpty({ message: 'Product name is required' })
  name!: string;

  @IsString()
  @IsOptional()
  printedName?: string;

  @IsUUID('4', { message: 'Category ID must be a valid UUID' })
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  categoryName?: string;

  @IsUUID('4', { message: 'Brand ID must be a valid UUID' })
  @IsOptional()
  brandId?: string;

  @IsString()
  @IsOptional()
  brandName?: string;

  @IsUUID('4', { message: 'Unit ID must be a valid UUID' })
  @IsOptional()
  unitId?: string;

  @IsUUID('4', { message: 'Size ID must be a valid UUID' })
  @IsOptional()
  sizeId?: string;

  @IsUUID('4', { message: 'Color ID must be a valid UUID' })
  @IsOptional()
  colorId?: string;

  @IsString()
  @IsOptional()
  grade?: string;

  @IsNumber({}, { message: 'Selling price must be a number' })
  sellingPrice!: number;

  @IsNumber({}, { message: 'Cost price must be a number' })
  costPrice!: number;

  @IsBoolean()
  @IsOptional()
  isService?: boolean;

  @IsBoolean()
  @IsOptional()
  trackSerial?: boolean;

  @IsUUID('4', { message: 'Supplier ID must be a valid UUID' })
  @IsOptional()
  supplierId?: string;

  @IsObject({ message: 'Member pricing must be an object' })
  @IsOptional()
  memberPricing?: Record<string, any>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmProductStockDto)
  @IsOptional()
  stocks?: ConfirmProductStockDto[];
}

export class ConfirmProductImportDto {
  @IsString()
  @IsNotEmpty()
  fileName!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmProductImportRowDto)
  rows!: ConfirmProductImportRowDto[];
}
