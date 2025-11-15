import { IsEnum, IsUUID, IsOptional, IsString } from 'class-validator';

export class ClockInDto {
  @IsEnum(['fingerprint', 'manual'])
  method!: string;

  @IsUUID()
  branch_id!: string;

  @IsOptional()
  @IsString()
  location?: string;
}

