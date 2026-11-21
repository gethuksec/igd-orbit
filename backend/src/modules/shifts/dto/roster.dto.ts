import { IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RosterQueryDto {
  @IsDateString()
  start!: string; // YYYY-MM-DD, range start (default: next month, set by FE)

  @IsDateString()
  end!: string; // YYYY-MM-DD, range end

  @IsOptional()
  @IsIn(['ALL', 'TERJADWAL', 'BELUM'])
  status?: string = 'ALL';

  // Superadmin only, comma-separated ids. Scoped users get Forbidden on use.
  @IsString()
  @IsOptional()
  departmentIds?: string;

  @IsString()
  @IsOptional()
  divisionIds?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}

export class DivisionOverlayQueryDto {
  @IsString()
  divisionId!: string;

  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;
}

export class RosterEntryDto {
  @IsDateString()
  date!: string; // YYYY-MM-DD

  @IsString()
  @IsOptional()
  shiftId?: string | null; // null = Libur
}

export class SubmitRosterDto {
  @IsString()
  employeeId!: string;

  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RosterEntryDto)
  entries!: RosterEntryDto[];
}
