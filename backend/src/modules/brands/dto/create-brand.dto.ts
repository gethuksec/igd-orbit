import {
  IsOptional,
  IsNotEmpty,
  IsString,
  IsUrl,
} from 'class-validator';

/**
 * Create Brand DTO
 * Validates brand creation request payload
 */
export class CreateBrandDto {
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string; // Auto-generate if not provided

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Brand name is required' })
  name!: string;

  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  description?: string;

  @IsUrl({}, { message: 'Logo URL must be a valid URL' })
  @IsOptional()
  logoUrl?: string;

  @IsUrl({}, { message: 'Website must be a valid URL' })
  @IsOptional()
  website?: string;
}

