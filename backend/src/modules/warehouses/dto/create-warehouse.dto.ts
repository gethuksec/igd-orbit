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
 * Validates warehouse creation request payload
 */
export class CreateWarehouseDto {
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string; // Auto-generate (WH-XXXXXXXX) if not provided

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Warehouse name is required' })
  name!: string;

  @IsUUID('4', { message: 'Outlet must be a valid UUID' })
  @IsNotEmpty({ message: 'Outlet is required' })
  outletId!: string;

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
