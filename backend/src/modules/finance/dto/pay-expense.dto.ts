import {
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';

export class PayExpenseDto {
  @IsEnum(['cash', 'transfer', 'check'])
  @IsNotEmpty()
  payment_method!: string;

  @IsUUID()
  @IsOptional()
  bank_account_id?: string;

  @IsOptional()
  reference_number?: string;

  @IsDateString()
  @IsOptional()
  payment_date?: string;

  @IsOptional()
  notes?: string;
}

