import { IsEnum, IsUUID, IsOptional, IsString, IsNumber, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class ClockInDto {
  @IsEnum(['fingerprint', 'manual', 'mobile'])
  method!: string;

  @IsUUID()
  branch_id!: string;

  @IsOptional()
  @IsString()
  clock_in_location?: string;

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
  @IsUrl({}, { message: 'photoUrl must be a valid URL from /attendance/selfie upload' })
  photoUrl?: string;
}
