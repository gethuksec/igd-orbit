import { IsOptional, IsString } from 'class-validator';

/**
 * Hold Transaction DTO
 * Validates hold transaction request payload
 */
export class HoldTransactionDto {
  @IsString({ message: 'Reference must be a string' })
  @IsOptional()
  reference?: string; // User-provided reference for the held transaction
}

