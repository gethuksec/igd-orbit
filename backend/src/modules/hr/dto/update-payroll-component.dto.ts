import { IsOptional, IsString, IsBoolean, IsInt, IsNumber, IsEnum, Min } from 'class-validator';

export class UpdatePayrollComponentDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['earning', 'deduction'])
  @IsOptional()
  category?: string;

  @IsEnum(['fixed', 'grade', 'computed', 'manual'])
  @IsOptional()
  source?: string;

  @IsNumber()
  @IsOptional()
  defaultAmount?: number | null;

  @IsOptional()
  tiers?: any;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
