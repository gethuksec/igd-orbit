import {
  IsOptional,
  IsNotEmpty,
  IsString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Create Payment Term DTO
 * Validates payment term creation request payload
 */
export class CreatePaymentTermDto {
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string; // Auto-generate if not provided

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Payment term name is required' })
  name!: string;

  @Type(() => Number)
  @IsInt({ message: 'Days must be an integer' })
  @Min(0, { message: 'Days cannot be negative' })
  @IsOptional()
  days?: number = 0; // Number of days (0 = Cash/COD)

  @IsOptional()
  isActive?: boolean; // Defaults to true on creation
}
