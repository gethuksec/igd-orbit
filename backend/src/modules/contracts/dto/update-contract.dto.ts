import { IsOptional, IsString, IsDateString, IsNumber, IsIn, IsUUID } from 'class-validator';
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

  @IsUUID('4')
  @IsOptional()
  workingLocationId?: string | null;

  @IsNumber()
  @IsOptional()
  basicSalary?: number;
}
