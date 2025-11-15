import {
  IsNotEmpty,
  IsDateString,
  IsNumber,
  Min,
  IsEnum,
  IsOptional,
  IsUUID,
  IsUrl,
} from 'class-validator';

export class CreateExpenseDto {
  @IsNotEmpty()
  expense_category!: string;

  @IsDateString()
  expense_date!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  tax_amount?: number;

  @IsEnum(['cash', 'transfer', 'petty-cash'])
  @IsOptional()
  payment_method?: string;

  @IsUUID()
  @IsOptional()
  bank_account_id?: string;

  @IsUUID()
  @IsOptional()
  branch_id?: string;

  @IsUUID()
  @IsOptional()
  department_id?: string;

  @IsUUID()
  gl_account_id!: string;

  @IsNotEmpty()
  description!: string;

  @IsUrl()
  @IsOptional()
  receipt_url?: string;

  @IsOptional()
  notes?: string;
}

