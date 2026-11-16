import { IsOptional, IsString, IsUUID, IsBoolean, IsNumber, IsInt, Min, Max } from 'class-validator';

export class UpdateWorkingLocationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsUUID('4')
  @IsOptional()
  branchId?: string | null;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  radiusM?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
