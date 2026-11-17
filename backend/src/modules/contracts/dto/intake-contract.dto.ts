import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsNumber,
  IsArray,
  IsEmail,
  IsIn,
} from 'class-validator';

export const INTAKE_STATUSES = ['draft', 'active'] as const;

export class IntakeContractDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName!: string;

  @IsEmail()
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsNotEmpty({ message: 'Contract type is required' })
  type!: string;

  @IsDateString()
  @IsNotEmpty({ message: 'Start date is required' })
  startDate!: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsDateString()
  @IsOptional()
  probationEndDate?: string;

  @IsUUID('4')
  @IsOptional()
  workingLocationId?: string;

  @IsNumber()
  @IsOptional()
  basicSalary?: number;

  @IsUUID('4')
  @IsOptional()
  positionId?: string;

  @IsUUID('4')
  @IsOptional()
  gradeId?: string;

  @IsUUID('4')
  @IsOptional()
  divisionId?: string;

  @IsUUID('4')
  @IsOptional()
  departmentId?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  branchIds?: string[];

  @IsUUID('4')
  @IsOptional()
  primaryBranchId?: string;

  @IsUUID('4')
  @IsOptional()
  roleId?: string;

  @IsString()
  @IsIn([...INTAKE_STATUSES] as string[])
  @IsOptional()
  status?: string;
}
