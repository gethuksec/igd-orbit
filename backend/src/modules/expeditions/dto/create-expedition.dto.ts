import {
  IsOptional,
  IsNotEmpty,
  IsString,
} from 'class-validator';

/**
 * Create Expedition DTO
 * Validates expedition creation request payload
 */
export class CreateExpeditionDto {
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string; // Auto-generate if not provided

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Expedition name is required' })
  name!: string;

  @IsOptional()
  isActive?: boolean; // Defaults to true on creation
}
