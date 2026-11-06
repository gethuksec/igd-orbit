import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * IGDERP-236 (OP4): Stock Opname approver setting (Administrator → General).
 * outletId omitted = global default (role code); outletId present = per-outlet
 * person override (userId null clears back to the default).
 */
export class UpsertApproverSettingDto {
  @IsUUID()
  @IsOptional()
  outletId?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsUUID()
  @IsOptional()
  userId?: string | null;
}
