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

  @IsString({ message: 'Filter sub-category must be a string' })
  @IsOptional()
  'filter[subCategory]'?: string; // Sub-category ID (Category hierarchy)

  @IsString({ message: 'Filter color must be a string' })
  @IsOptional()
  'filter[color]'?: string; // Color ID

  @IsString({ message: 'Filter size must be a string' })
  @IsOptional()
  'filter[size]'?: string; // Size ID

  @IsString({ message: 'Filter unit must be a string' })
  @IsOptional()
  'filter[unit]'?: string; // Unit ID

  @IsString({ message: 'Filter supplier must be a string' })
  @IsOptional()
  'filter[supplier]'?: string; // Supplier ID (Customer)

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

  @IsString({ message: 'Filter price operator must be a string' })
  @IsIn(['gt', 'lt', 'eq'], {
    message: 'Filter price operator must be one of: gt, lt, eq',
  })
  @IsOptional()
  'filter[priceOp]'?: 'gt' | 'lt' | 'eq'; // Compare operator for selling price

  @Type(() => Number)
  @IsInt({ message: 'Price value must be a number' })
  @Min(0, { message: 'Price value must be greater than or equal to 0' })
  @IsOptional()
  'filter[priceValue]'?: number; // Compare value for selling price

  @IsString({ message: 'Filter cost operator must be a string' })
  @IsIn(['gt', 'lt', 'eq'], {
    message: 'Filter cost operator must be one of: gt, lt, eq',
  })
  @IsOptional()
  'filter[costOp]'?: 'gt' | 'lt' | 'eq'; // Compare operator for cost (modal) price

  @Type(() => Number)
  @IsInt({ message: 'Cost value must be a number' })
  @Min(0, { message: 'Cost value must be greater than or equal to 0' })
  @IsOptional()
  'filter[costValue]'?: number; // Compare value for cost (modal) price

  @IsString({ message: 'Filter stock operator must be a string' })
  @IsIn(['gt', 'lt', 'eq'], {
    message: 'Filter stock operator must be one of: gt, lt, eq',
  })
  @IsOptional()
  'filter[stockOp]'?: 'gt' | 'lt' | 'eq'; // Compare operator for total available stock

  @Type(() => Number)
  @IsInt({ message: 'Stock value must be a number' })
  @Min(0, { message: 'Stock value must be greater than or equal to 0' })
  @IsOptional()
  'filter[stockValue]'?: number; // Compare value for total available stock

  @IsString({ message: 'Filter sold operator must be a string' })
  @IsIn(['gt', 'lt', 'eq'], {
    message: 'Filter sold operator must be one of: gt, lt, eq',
  })
  @IsOptional()
  'filter[soldOp]'?: 'gt' | 'lt' | 'eq'; // Compare operator for all-time units sold

  @Type(() => Number)
  @IsInt({ message: 'Sold value must be a number' })
  @Min(0, { message: 'Sold value must be greater than or equal to 0' })
  @IsOptional()
  'filter[soldValue]'?: number; // Compare value for all-time units sold

  @IsString({ message: 'Filter age operator must be a string' })
  @IsIn(['gt', 'lt', 'eq'], {
    message: 'Filter age operator must be one of: gt, lt, eq',
  })
  @IsOptional()
  'filter[ageOp]'?: 'gt' | 'lt' | 'eq'; // Compare operator for product age since last restock

  @Type(() => Number)
  @IsInt({ message: 'Age value must be a number' })
  @Min(0, { message: 'Age value must be greater than or equal to 0' })
  @IsOptional()
  'filter[ageValue]'?: number; // Age value in the given unit

  @IsString({ message: 'Filter age unit must be a string' })
  @IsIn(['days', 'months', 'years'], {
    message: 'Filter age unit must be one of: days, months, years',
  })
  @IsOptional()
  'filter[ageUnit]'?: 'days' | 'months' | 'years' = 'days';

  @IsString({ message: 'Filter type must be a string' })
  @IsIn(['product', 'service', 'all'], {
    message: 'Filter type must be one of: product, service, all',
  })
  @IsOptional()
  'filter[type]'?: string = 'all'; // Filter by product/service type

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
  @IsIn(['category', 'brand', 'stock', 'subCategory', 'supplier', 'unit', 'size', 'color'], {
    each: true,
    message: 'Include can only contain: category, brand, stock, subCategory, supplier, unit, size, color',
  })
  @IsOptional()
  include?: string[] = ['category', 'brand'];
}

