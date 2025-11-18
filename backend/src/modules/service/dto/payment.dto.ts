import { IsString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';

export enum PaymentMethod {
  CASH = 'cash',
  TRANSFER = 'transfer',
  E_WALLET = 'e_wallet',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
}

export class ProcessPaymentDto {
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsOptional()
  reference?: string; // For transfer/e-wallet reference number

  @IsString()
  @IsOptional()
  notes?: string;
}

