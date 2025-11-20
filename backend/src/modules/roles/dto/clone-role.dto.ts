import { IsString, IsOptional } from 'class-validator';

export class CloneRoleDto {
  @IsString()
  newCode!: string;

  @IsOptional()
  @IsString()
  newName?: string;
}

