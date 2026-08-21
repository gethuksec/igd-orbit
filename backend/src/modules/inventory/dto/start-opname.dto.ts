import { IsUUID, IsDateString, IsOptional } from 'class-validator';

export class StartOpnameDto {
  @IsUUID()
  @IsOptional()
  warehouseId?: string;

  @IsUUID()
  @IsOptional()
  branchId?: string; // Legacy fallback to the outlet's default GOOD warehouse

  @IsDateString()
  opnameDate!: string;

  @IsOptional()
  notes?: string;
}

