import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class ListPayrollComponentsDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  status?: string; // 'active' | 'inactive' | 'all'

  @IsString()
  @IsOptional()
  category?: string; // 'earning' | 'deduction'

  @IsBoolean()
  @IsOptional()
  includeInactive?: boolean;
}
