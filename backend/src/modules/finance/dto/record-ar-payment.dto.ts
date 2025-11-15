import {
  IsDateString,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
  IsUUID,
  IsNotEmpty,
} from 'class-validator';

export class RecordARPaymentDto {
  @IsDateString()
  @IsOptional()
  payment_date?: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsEnum(['cash', 'transfer', 'check'])
  @IsNotEmpty()
  payment_method!: string;

  @IsUUID()
  @IsOptional()
  bank_account_id?: string;

  @IsOptional()
  reference_number?: string;

  @IsOptional()
  notes?: string;
}

