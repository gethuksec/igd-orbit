import { IsUUID, IsDateString, IsOptional } from 'class-validator';

export class StartOpnameDto {
  @IsUUID()
  branchId!: string;

  @IsDateString()
  opnameDate!: string;

  @IsOptional()
  notes?: string;
}

