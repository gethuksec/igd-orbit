import { IsNotEmpty, IsOptional, IsString, IsUUID, IsBoolean, IsInt, Min } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Department code is required' })
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'Department name is required' })
  name!: string;

  @IsInt({ message: 'Level must be an integer (root = 1, child = parent + 1, 0 reserved)' })
  @Min(1, { message: 'Level 0 is reserved — roots start at 1' })
  @IsOptional()
  level?: number;

  @IsUUID('4')
  @IsOptional()
  parentDepartmentId?: string;

  @IsUUID('4')
  @IsOptional()
  branchId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
