import {
  IsOptional,
  IsNotEmpty,
  IsString,
} from 'class-validator';

/**
 * Create Unit DTO
 * Validates unit creation request payload
 */
export class CreateUnitDto {
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string; // Auto-generate if not provided

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Unit name is required' })
  name!: string;
}
