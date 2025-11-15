import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ClockOutDto {
  @IsEnum(['fingerprint', 'manual'])
  method!: string;

  @IsOptional()
  @IsString()
  location?: string;
}

