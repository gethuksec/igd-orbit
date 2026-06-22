import { IsNotEmpty, IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Department name is required' })
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

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
