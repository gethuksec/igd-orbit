import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsArray,
  IsString,
} from 'class-validator';

/**
 * Assign Role DTO
 * Validates role assignment request payload
 */
export class AssignRoleDto {
  @IsUUID('4', { message: 'Role ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Role ID is required' })
  roleId!: string;

  @IsUUID('4', { message: 'Branch ID must be a valid UUID' })
  @IsOptional()
  branchId?: string;

  @IsBoolean({ message: 'isPrimary must be a boolean' })
  @IsOptional()
  isPrimary?: boolean = false;

  @IsArray({ message: 'deniedPermissions must be an array' })
  @IsString({ each: true, message: 'Each denied permission must be a string' })
  @IsOptional()
  deniedPermissions?: string[];
}
