import { IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';

export class UpdateDivisionDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsUUID('4')
  @IsOptional()
  departmentId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
