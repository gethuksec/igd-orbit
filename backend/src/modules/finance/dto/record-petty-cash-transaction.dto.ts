import {
  IsEnum,
  IsNumber,
  Min,
  IsNotEmpty,
  IsUrl,
  IsOptional,
} from 'class-validator';

export class RecordPettyCashTransactionDto {
  @IsEnum(['disbursement', 'replenishment'])
  transaction_type!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsNotEmpty()
  category!: string;

  @IsNotEmpty()
  description!: string;

  @IsUrl()
  @IsOptional()
  receipt_url?: string;
}

