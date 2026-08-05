import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsObject,
} from 'class-validator';

export class CreateBranchDto {
  @IsString({ message: 'Code must be a string' })
  @IsOptional()
  code?: string; // Optional, will be auto-generated if not provided

  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @IsString({ message: 'Group must be a string' })
  @IsOptional()
  group?: string;

  @IsString({ message: 'Phone must be a string' })
  @IsOptional()
  phone?: string;

  @IsString({ message: 'Email must be a string' })
  @IsOptional()
  email?: string;

  @IsString({ message: 'Address must be a string' })
  @IsOptional()
  address?: string;

  @IsString({ message: 'City must be a string' })
  @IsOptional()
  city?: string;

  @IsString({ message: 'Province must be a string' })
  @IsOptional()
  province?: string;

  @IsString({ message: 'Director must be a string' })
  @IsOptional()
  director?: string;

  @IsString({ message: 'Contact person must be a string' })
  @IsOptional()
  contactPerson?: string;

  @IsString({ message: 'Mobile phone must be a string' })
  @IsOptional()
  mobilePhone?: string;

  @IsString({ message: 'Head of Service ID must be a string' })
  @IsNotEmpty({ message: 'Head of Service is required' })
  headOfServiceId!: string;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean = true;

  @IsObject({ message: 'Operating hours must be an object' })
  @IsOptional()
  operatingHours?: Record<string, any>; // JSONB format
}

