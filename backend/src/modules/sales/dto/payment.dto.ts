import {
  IsEnum,
  IsNumber,
  Min,
  IsObject,
  IsOptional,
} from 'class-validator';

/**
 * Payment DTO
 * Validates payment data
 */
export class PaymentDto {
  @IsEnum(['cash', 'card', 'transfer', 'e-wallet', 'credit', 'deposit'], {
    message: 'Payment method must be one of: cash, card, transfer, e-wallet, credit, deposit',
  })
  method!: string;

  @IsNumber({}, { message: 'Amount must be a number' })
  @Min(0, { message: 'Amount must be greater than or equal to 0' })
  amount!: number;

  @IsObject({ message: 'Details must be an object' })
  @IsOptional()
  details?: Record<string, any>; // card last4, transfer ref, etc
}

