import {
  IsUUID,
  IsNumber,
  IsEnum,
  IsString,
  IsOptional,
  Min,
} from 'class-validator';

/**
 * Create Customer Deposit DTO
 * Validates deposit creation request payload
 */
export class CreateCustomerDepositDto {
  @IsUUID('4', { message: 'Customer ID must be a valid UUID' })
  customerId!: string;

  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(1, { message: 'Amount must be greater than 0' })
  amount!: number;

  @IsEnum(['return_credit', 'payment_used', 'refund'], {
    message: 'Type must be one of: return_credit, payment_used, refund',
  })
  type!: string;

  @IsUUID('4', { message: 'Reference ID must be a valid UUID' })
  @IsOptional()
  referenceId?: string;

  @IsString({ message: 'Notes must be a string' })
  @IsOptional()
  notes?: string;
}
