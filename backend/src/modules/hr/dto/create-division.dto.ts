import { IsNotEmpty, IsOptional, IsString, IsUUID, IsBoolean } from 'class-validator';

export class CreateDivisionDto {
  @IsString()
  @IsNotEmpty({ message: 'Division code is required' })
  code!: string;

  @IsString()
  @IsNotEmpty({ message: 'Division name is required' })
  name!: string;

  @IsUUID('4')
  @IsNotEmpty({ message: 'Department is required' })
  departmentId!: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
