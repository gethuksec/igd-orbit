import {
  IsInt,
  Min,
  Max,
  IsArray,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CalculatePayrollDto {
  @IsInt()
  @Min(1)
  @Max(12)
  period_month!: number;

  @IsInt()
  period_year!: number;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  employee_ids?: string[];
}

