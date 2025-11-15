import {
  IsEnum,
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
} from 'class-validator';

export class PayrollComponentDto {
  @IsEnum(['earning', 'deduction'])
  type!: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  formula?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

