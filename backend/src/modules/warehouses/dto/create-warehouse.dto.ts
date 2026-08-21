import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

/**
 * Create Warehouse DTO
 * Validates warehouse creation request payload. Scope/type combinations
 * are normalized and enforced by WarehousesService.
 */
export class CreateWarehouseDto {
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string; // Auto-generate (WH-XXXXXXXX) if not provided

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Warehouse name is required' })
  name!: string;

  @IsString({ message: 'Warehouse type must be a string' })
  @IsOptional()
  type?: string; // GOOD (default) or BAD (Central Bad Stock)

  @IsString({ message: 'Warehouse scope must be a string' })
  @IsOptional()
  scope?: string; // OUTLET (default) or SYSTEM

  @IsUUID('4', { message: 'Outlet must be a valid UUID' })
  @IsOptional()
  outletId?: string | null; // Required for OUTLET scope, null for SYSTEM scope

  @IsString({ message: 'City must be a string' })
  @IsOptional()
  city?: string;

  @IsString({ message: 'Address must be a string' })
  @IsOptional()
  address?: string;

  @IsString({ message: 'Phone must be a string' })
  @IsOptional()
  phone?: string;

  @ValidateIf((o) => o.email !== undefined && o.email !== null && o.email !== '')
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsOptional()
  email?: string;

  @IsString({ message: 'Contact person must be a string' })
  @IsOptional()
  contactPerson?: string;

  @IsString({ message: 'Mobile phone must be a string' })
  @IsOptional()
  mobilePhone?: string;

  @IsOptional()
  isActive?: boolean; // Defaults to true on creation
}
