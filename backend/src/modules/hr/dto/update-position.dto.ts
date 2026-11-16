import { IsOptional, IsString, IsUUID, IsBoolean, IsInt, Min, Max, IsNumber } from 'class-validator';

export class UpdatePositionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsInt({ message: 'Rank must be an integer (chart level L0-L6)' })
  @Min(0)
  @Max(10)
  @IsOptional()
  rank?: number;

  @IsUUID('4')
  @IsOptional()
  divisionId?: string | null;

  @IsUUID('4')
  @IsOptional()
  departmentId?: string | null;

  @IsUUID('4')
  @IsOptional()
  gradeId?: string | null;

  @IsNumber({}, { message: 'minSalary must be a number' })
  @Min(0)
  @IsOptional()
  minSalary?: number | null;

  @IsUUID('4')
  @IsOptional()
  defaultRoleId?: string | null;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
