import {
  IsOptional,
  IsNotEmpty,
  IsString,
} from 'class-validator';

/**
 * Create Sales Type DTO
 * Validates sales type creation request payload
 */
export class CreateSalesTypeDto {
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string; // Auto-generate if not provided

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Sales type name is required' })
  name!: string;

  @IsOptional()
  isActive?: boolean; // Defaults to true on creation
}
