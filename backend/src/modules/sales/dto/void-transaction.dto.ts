import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

/**
 * Void Transaction DTO
 * Validates void transaction request payload
 */
export class VoidTransactionDto {
  @IsString({ message: 'Reason must be a string' })
  @IsNotEmpty({ message: 'Void reason is required' })
  reason!: string;

  @IsBoolean({ message: 'refundAsDeposit must be a boolean' })
  @IsOptional()
  refundAsDeposit?: boolean;
}

