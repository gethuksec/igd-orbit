import { IsString, IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';

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
}

