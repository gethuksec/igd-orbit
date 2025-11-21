import { IsEnum, IsUUID, IsOptional, IsString } from 'class-validator';

export class ClockInDto {
  @IsEnum(['fingerprint', 'manual'])
  method!: string;

  @IsUUID()
  branch_id!: string;

  @IsOptional()
  @IsString()
  clock_in_location?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

