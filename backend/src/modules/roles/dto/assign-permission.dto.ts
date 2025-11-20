import { IsString, IsOptional, IsNumber, IsBoolean, IsObject, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignPermissionDto {
  @IsString()
  permissionId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxAmount?: number;

  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, any>; // JSON object for flexible conditions
}

