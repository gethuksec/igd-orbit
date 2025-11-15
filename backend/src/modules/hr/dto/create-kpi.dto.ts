import {
  IsUUID,
  IsInt,
  IsNumber,
  Min,
  Max,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateKPIDto {
  @IsUUID()
  employee_id!: string;

  @IsInt()
  @Min(1)
  @Max(12)
  period_month!: number;

  @IsInt()
  period_year!: number;

  @IsOptional()
  @IsNumber()
  sales_target_achievement?: number;

  @IsOptional()
  @IsNumber()
  service_quality_score?: number;

  @IsOptional()
  @IsNumber()
  customer_satisfaction?: number;

  @IsOptional()
  @IsNumber()
  attendance_score?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  overall_score!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

