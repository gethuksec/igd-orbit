import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsIn,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * List Users DTO
 * Validates query parameters for user listing
 */
export class ListUsersDto {
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
  limit?: number = 10;

  @IsString({ message: 'Search must be a string' })
  @IsOptional()
  search?: string;

  @IsString({ message: 'Filter role must be a string' })
  @IsOptional()
  'filter[role]'?: string;

  @IsUUID('4', { message: 'Filter branch must be a valid UUID' })
  @IsOptional()
  'filter[branch]'?: string;

  @IsString({ message: 'Filter status must be a string' })
  @IsIn(['active', 'inactive', 'all'], {
    message: 'Filter status must be one of: active, inactive, all',
  })
  @IsOptional()
  'filter[status]'?: string = 'active';

  @IsString({ message: 'Sort must be a string' })
  @IsIn(['createdAt', 'updatedAt', 'email', 'fullName', 'username'], {
    message:
      'Sort must be one of: createdAt, updatedAt, email, fullName, username',
  })
  @IsOptional()
  sort?: string = 'createdAt';

  @IsString({ message: 'Order must be a string' })
  @IsIn(['asc', 'desc'], { message: 'Order must be either asc or desc' })
  @IsOptional()
  order?: 'asc' | 'desc' = 'desc';
}
