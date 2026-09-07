import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const nonEmpty = (o: any, prop: string) =>
  o[prop] !== undefined && o[prop] !== null && o[prop] !== '';

export class StockRequestItemDto {
  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  @IsIn(['EXIST', 'NEW'], { message: 'listing must be EXIST or NEW' })
  listing!: string;

  @ValidateIf((o) => nonEmpty(o, 'productId'))
  @IsUUID('4', { message: 'productId must be a valid UUID' })
  productId?: string;

  @IsOptional()
  @IsString()
  productName?: string;

  @ValidateIf((o) => nonEmpty(o, 'categoryId'))
  @IsUUID('4', { message: 'categoryId must be a valid UUID' })
  categoryId?: string;

  @IsOptional()
  @IsString()
  categoryName?: string;

  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity minimum is 1' })
  @Max(9999, { message: 'quantity maximum is 9999' })
  quantity!: number;
}

export class CreateStockRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'staffName is required' })
  staffName!: string;

  @IsString()
  @IsIn(['USER', 'MEMBER'], { message: 'customerType must be USER or MEMBER' })
  customerType!: string;

  @IsOptional()
  @IsString()
  memberRef?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Minimal 1 barang.' })
  @ArrayMaxSize(50, { message: 'Maksimal 50 barang per request.' })
  @ValidateNested({ each: true })
  @Type(() => StockRequestItemDto)
  items!: StockRequestItemDto[];
}
