import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ClockOutDto {
  @IsEnum(['fingerprint', 'manual'])
  method!: string;

  @IsOptional()
  @IsString()
  clock_out_location?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

