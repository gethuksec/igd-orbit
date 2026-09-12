import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateDeviceTypeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
