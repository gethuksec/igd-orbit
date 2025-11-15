import {
  IsArray,
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class JournalLineDto {
  @IsUUID()
  account_id!: string;

  @IsNumber()
  @Min(0)
  debit_amount: number = 0;

  @IsNumber()
  @Min(0)
  credit_amount: number = 0;

  @IsOptional()
  line_description?: string;

  @IsUUID()
  @IsOptional()
  branch_id?: string;

  @IsUUID()
  @IsOptional()
  department_id?: string;
}

export class CreateJournalEntryDto {
  @IsOptional()
  entry_number?: string;

  @IsDateString()
  entry_date!: string;

  @IsEnum(['manual', 'auto'])
  entry_type!: string;

  @IsNotEmpty()
  description!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];

  @IsOptional()
  reference_type?: string;

  @IsOptional()
  @IsUUID()
  reference_id?: string;

  @IsOptional()
  notes?: string;
}

