import { IsNotEmpty, IsString, IsDateString, IsOptional } from 'class-validator';

/**
 * Blacklist Customer DTO
 * Validates blacklist request payload
 */
export class BlacklistCustomerDto {
  @IsString({ message: 'Reason must be a string' })
  @IsNotEmpty({ message: 'Blacklist reason is required' })
  reason!: string;

  @IsDateString({}, { message: 'Blacklist until must be a valid date string' })
  @IsOptional()
  blacklistUntil?: string; // Optional expiry date for blacklist
}

