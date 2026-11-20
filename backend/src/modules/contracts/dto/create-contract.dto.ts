import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsNumber,
  IsArray,
  IsIn,
} from 'class-validator';

export const CONTRACT_TYPES = ['trial', 'probation', 'pkwt', 'pkwtt'] as const;
export const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated', 'renewed'] as const;
export const CHANGE_REASONS = ['initial', 'promotion', 'demotion', 'rotation', 'renewal', 'adjustment'] as const;

export class CreateContractDto {
  @IsUUID('4')
  @IsNotEmpty({ message: 'Employee is required' })
  employeeId!: string;

  @IsString()
  @IsOptional()
  contractNumber?: string;

  @IsString()
  @IsIn([...CONTRACT_TYPES] as string[])
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

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  workingLocationIds?: string[];

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

  @IsString()
  @IsOptional()
  changeReason?: string;

  @IsString()
  @IsIn([...CONTRACT_STATUSES] as string[])
  @IsOptional()
  status?: string;

  @IsUUID('4')
  @IsOptional()
  previousContractId?: string;

  @IsString()
  @IsOptional()
  approvedBy?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  branchIds?: string[];

  @IsUUID('4')
  @IsOptional()
  primaryBranchId?: string;
}
