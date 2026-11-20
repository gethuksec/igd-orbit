import { IsOptional, IsString, IsDateString, IsNumber, IsIn, IsUUID, IsArray } from 'class-validator';
import { CONTRACT_STATUSES } from './create-contract.dto';

export class UpdateContractDto {
  @IsDateString()
  @IsOptional()
  endDate?: string | null;

  @IsDateString()
  @IsOptional()
  probationEndDate?: string | null;

  @IsString()
  @IsIn([...CONTRACT_STATUSES] as string[])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  approvedBy?: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  workingLocationIds?: string[];

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  branchIds?: string[];

  @IsUUID('4')
  @IsOptional()
  primaryBranchId?: string | null;

  @IsNumber()
  @IsOptional()
  basicSalary?: number | null;

  // Reference snapshots — editable while the contract is still a draft
  // (activation requires them; history rows are never edited).
  @IsUUID('4')
  @IsOptional()
  positionId?: string | null;

  @IsUUID('4')
  @IsOptional()
  gradeId?: string | null;

  @IsUUID('4')
  @IsOptional()
  divisionId?: string | null;

  @IsUUID('4')
  @IsOptional()
  departmentId?: string | null;
}
