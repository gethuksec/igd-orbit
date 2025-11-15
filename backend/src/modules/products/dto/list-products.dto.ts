import { IsOptional, IsString, IsInt, Min, Max, IsIn, IsArray } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * List Products DTO
 * Validates query parameters for product listing
 */
export class ListProductsDto {
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  @IsOptional()
  limit?: number = 20;

  @IsString({ message: 'Search must be a string' })
  @IsOptional()
  search?: string; // Search by name, SKU, barcode

  @IsString({ message: 'Filter category must be a string' })
  @IsOptional()
  'filter[category]'?: string; // Category ID

  @IsString({ message: 'Filter brand must be a string' })
  @IsOptional()
  'filter[brand]'?: string; // Brand ID

  @IsString({ message: 'Filter status must be a string' })
  @IsIn(['active', 'inactive', 'all'], {
    message: 'Filter status must be one of: active, inactive, all',
  })
  @IsOptional()
  'filter[status]'?: string = 'active';

  @Type(() => Number)
  @IsInt({ message: 'Min price must be a number' })
  @Min(0, { message: 'Min price must be greater than or equal to 0' })
  @IsOptional()
  'filter[minPrice]'?: number;

  @Type(() => Number)
  @IsInt({ message: 'Max price must be a number' })
  @Min(0, { message: 'Max price must be greater than or equal to 0' })
  @IsOptional()
  'filter[maxPrice]'?: number;

  @IsString({ message: 'Sort must be a string' })
  @IsIn(['name', 'price', 'stock', 'createdAt'], {
    message: 'Sort must be one of: name, price, stock, createdAt',
  })
  @IsOptional()
  sort?: string = 'name';

  @IsString({ message: 'Order must be a string' })
  @IsIn(['asc', 'desc'], { message: 'Order must be either asc or desc' })
  @IsOptional()
  order?: 'asc' | 'desc' = 'asc';

  @Transform(({ value }) => {
    if (!value) return ['category', 'brand'];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      // Handle comma-separated string: "category,brand" -> ["category", "brand"]
      return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return ['category', 'brand'];
  })
  @IsArray({ message: 'Include must be an array' })
  @IsString({ each: true, message: 'Each include value must be a string' })
  @IsIn(['category', 'brand', 'stock'], {
    each: true,
    message: 'Include can only contain: category, brand, stock',
  })
  @IsOptional()
  include?: string[] = ['category', 'brand'];
}

