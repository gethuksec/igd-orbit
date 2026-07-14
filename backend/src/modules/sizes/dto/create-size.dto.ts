import {
  IsOptional,
  IsNotEmpty,
  IsString,
} from 'class-validator';

/**
 * Create Size DTO
 * Validates size creation request payload
 */
export class CreateSizeDto {
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string; // Auto-generate if not provided

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Size name is required' })
  name!: string;
}
