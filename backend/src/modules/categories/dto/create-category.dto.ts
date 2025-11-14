import {
  IsOptional,
  IsNotEmpty,
  IsString,
  IsUUID,
  IsNumber,
  IsUrl,
} from 'class-validator';

/**
 * Create Category DTO
 * Validates category creation request payload
 */
export class CreateCategoryDto {
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string; // Auto-generate if not provided

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Category name is required' })
  name!: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsUUID('4', { message: 'Parent category ID must be a valid UUID' })
  @IsOptional()
  parentCategoryId?: string;

  @IsNumber({}, { message: 'Sort order must be a number' })
  @IsOptional()
  sortOrder?: number;

  @IsUrl({}, { message: 'Image URL must be a valid URL' })
  @IsOptional()
  imageUrl?: string;
}

