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
  @IsNotEmpty({ message: 'Position code is required' })
  code!: string;

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
  gradeId?: string;

  @IsNumber({}, { message: 'minSalary must be a number' })
  @Min(0)
  @IsOptional()
  minSalary?: number;

  @IsUUID('4')
  @IsOptional()
  defaultRoleId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
