import { IsString, IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsInt()
  @Min(0)
  @Max(10)
  level!: number;

  @IsOptional()
  @IsBoolean()
  isSystemRole?: boolean;
}

