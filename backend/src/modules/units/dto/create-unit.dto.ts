import {
  IsOptional,
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';

/**
 * Create Unit DTO
 * Validates unit creation request payload
 */
export class CreateUnitDto {
  @IsString({ message: 'Code must be a string' })
  @Matches(/^[A-Z0-9]{10}$/, {
    message: 'Code must be 10 uppercase alphanumeric characters (A-Z, 0-9)',
  })
  @IsOptional()
  code?: string; // Auto-generate (10-digit) if not provided

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Unit name is required' })
  name!: string;

  @IsOptional()
  isActive?: boolean; // Defaults to true on creation
}
