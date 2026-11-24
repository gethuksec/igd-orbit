import { IsEnum, IsOptional, IsString, IsNumber, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { SELFIE_URL_MESSAGE, SELFIE_URL_PATTERN } from './selfie-url';

export class ClockOutDto {
  @IsEnum(['fingerprint', 'manual', 'mobile'])
  method!: string;

  @IsOptional()
  @IsString()
  clock_out_location?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // IGDERP-275: mandatory for method='mobile' (photo + GPS proof)
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'latitude must be a number' })
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'longitude must be a number' })
  longitude?: number;

  @IsOptional()
  @IsString()
  @Matches(SELFIE_URL_PATTERN, { message: SELFIE_URL_MESSAGE })
  photoUrl?: string;
}
