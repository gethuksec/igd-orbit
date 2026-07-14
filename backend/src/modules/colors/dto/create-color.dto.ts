import {
  IsOptional,
  IsNotEmpty,
  IsString,
} from 'class-validator';

/**
 * Create Color DTO
 * Validates color creation request payload
 */
export class CreateColorDto {
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string; // Auto-generate if not provided

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Color name is required' })
  name!: string;

  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;
}
