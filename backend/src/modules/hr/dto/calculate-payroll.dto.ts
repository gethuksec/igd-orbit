import {
  IsInt,
  Min,
  Max,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CalculatePayrollComponentDto {
  @IsUUID('4')
  masterId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CalculatePayrollDto {
  @IsInt()
  @Min(1)
  @Max(12)
  period_month!: number;

  @IsInt()
  @Min(2000)
  period_year!: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  employee_ids?: string[];

  @IsArray()
  @ArrayMinSize(1, { message: 'Minimal 1 komponen payroll wajib dipilih' })
  @ValidateNested({ each: true })
  @Type(() => CalculatePayrollComponentDto)
  components!: CalculatePayrollComponentDto[];
}
