import { IsOptional, IsString, IsInt, Min, IsIn, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * List Customers DTO
 * Validates query parameters for customer listing
 */
export class ListCustomersDto {
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @IsIn([10, 20, 50, 100], { message: 'Limit must be one of: 10, 20, 50, 100' })
  @IsOptional()
  limit?: number = 20;

  @IsString({ message: 'Search must be a string' })
  @IsOptional()
  search?: string; // Search by name, phone, email, customer_code

  @IsArray({ message: 'Filter tier must be an array' })
  @IsString({ each: true, message: 'Each tier must be a string' })
  @IsOptional()
  'filter[tier]'?: string[]; // Tier IDs

  @IsArray({ message: 'Filter type must be an array' })
  @IsString({ each: true, message: 'Each type must be a string' })
  @IsIn(['retail', 'wholesale', 'corporate'], {
    each: true,
    message: 'Each type must be one of: retail, wholesale, corporate',
  })
  @IsOptional()
  'filter[type]'?: string[];

  @IsString({ message: 'Filter branch must be a string' })
  @IsOptional()
  'filter[branch]'?: string; // Branch ID

  @IsString({ message: 'Filter status must be a string' })
  @IsIn(['active', 'inactive'], {
    message: 'Filter status must be one of: active, inactive',
  })
  @IsOptional()
  'filter[status]'?: string = 'active';

  @Type(() => Boolean)
  @IsBoolean({ message: 'Filter blacklisted must be a boolean' })
  @IsOptional()
  'filter[blacklisted]'?: boolean;

  @IsString({ message: 'Sort must be a string' })
  @IsIn(['name', 'createdAt'], {
    message: 'Sort must be one of: name, createdAt',
  })
  @IsOptional()
  sort?: string = 'createdAt';

  @IsString({ message: 'Order must be a string' })
  @IsIn(['asc', 'desc'], { message: 'Order must be either asc or desc' })
  @IsOptional()
  order?: 'asc' | 'desc' = 'asc';
}

