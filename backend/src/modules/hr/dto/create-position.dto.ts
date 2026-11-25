import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsNumber,
} from 'class-validator';

export class CreatePositionDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty({ message: 'Position name is required' })
  name!: string;

  @IsInt({ message: 'Rank must be an integer (chart level L0-L6)' })
  @Min(0)
  @Max(10)
  @IsNotEmpty({ message: 'Rank is required' })
  rank!: number;

  @IsUUID('4')
  @IsOptional()
  divisionId?: string;

  @IsUUID('4')
  @IsOptional()
  departmentId?: string;

  @IsUUID('4')
  @IsOptional()
  parentPositionId?: string | null; // N+1: direct atasan title; null = top (MU)

  @IsUUID('4')
  @IsOptional()
  gradeId?: string;

  @IsNumber({}, { message: 'minSalary must be a number' })
  @Min(0)
  @IsOptional()
  minSalary?: number;

  @IsUUID('4')
  @IsOptional()
  defaultRoleId?: string;

  @IsUUID('4')
  @IsOptional()
  defaultShiftId?: string | null; // IGDERP-265: title default shift

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
