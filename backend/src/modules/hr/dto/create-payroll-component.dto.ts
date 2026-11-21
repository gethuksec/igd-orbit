import { IsNotEmpty, IsOptional, IsString, IsBoolean, IsInt, IsNumber, IsEnum, Min } from 'class-validator';

export class CreatePayrollComponentDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty({ message: 'Component name is required' })
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['earning', 'deduction'])
  @IsNotEmpty({ message: 'Category (earning|deduction) is required' })
  category!: string;

  @IsEnum(['fixed', 'grade', 'computed', 'manual'])
  @IsOptional()
  source?: string;

  @IsNumber()
  @IsOptional()
  defaultAmount?: number;

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
