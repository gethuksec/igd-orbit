import {
  IsOptional,
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
} from 'class-validator';

/**
 * Create Brand DTO
 * Validates brand creation request payload
 */
export class CreateBrandDto {
  @IsString({ message: 'Code must be a string' })
  @Matches(/^[A-Z0-9]{10}$/, {
    message: 'Code must be 10 uppercase alphanumeric characters (A-Z, 0-9)',
  })
  @IsOptional()
  code?: string; // Auto-generate (10-digit) if not provided

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

