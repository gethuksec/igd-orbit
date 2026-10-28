import { IsUUID, IsDateString, IsOptional, IsIn, IsArray, ArrayUnique } from 'class-validator';

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

  // IGDERP-233 (OP1): FREEZE blocks all outlet stock moves; OPEN keeps selling + logs movement
  @IsOptional()
  @IsIn(['FREEZE', 'OPEN'])
  opnameType?: 'FREEZE' | 'OPEN';

  // IGDERP-233 (OP1): assigned approver (default = outlet manager; OP4 adds the General setting source)
  @IsUUID()
  @IsOptional()
  approverId?: string;

  // IGDERP-233 (OP1): snapshot scope filter — empty/omitted = all categories (OP2 adds per-user mapping)
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  @IsOptional()
  categoryIds?: string[];
}
