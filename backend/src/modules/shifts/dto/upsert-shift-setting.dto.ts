import { IsInt, IsOptional, Max, Min } from 'class-validator';

/** IGDERP-265: roster input window (HR/Superadmin editable). Release = roster submitted flag. */
export class UpsertShiftSettingDto {
  @IsInt()
  @Min(1)
  @Max(28)
  @IsOptional()
  rosterOpenDay?: number;

  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  rosterCloseDay?: number | null;

  @IsInt()
  @Min(1)
  @Max(28)
  @IsOptional()
  employeeInputStartDay?: number;
}
