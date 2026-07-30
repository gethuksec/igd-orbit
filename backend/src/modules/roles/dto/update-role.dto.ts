import { IsString, IsOptional, IsInt, Min, Max, IsBoolean, IsUUID, IsArray } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  level?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  parentRoleId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultPermissions?: string[];
}

