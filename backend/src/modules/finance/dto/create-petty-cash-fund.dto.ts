import {
  IsUUID,
  IsNumber,
  Min,
  IsDateString,
  IsOptional,
} from 'class-validator';

export class CreatePettyCashFundDto {
  @IsOptional()
  fund_number?: string;

  @IsUUID()
  branch_id!: string;

  @IsNumber()
  @Min(0)
  opening_balance!: number;

  @IsUUID()
  custodian_id!: string;

  @IsDateString()
  period_start!: string;

  @IsDateString()
  @IsOptional()
  period_end?: string;
}

