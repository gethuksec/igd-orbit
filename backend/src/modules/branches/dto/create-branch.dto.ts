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

  @IsString({ message: 'Type must be a string' })
  @IsOptional()
  type?: string; // 'store', 'warehouse', 'office'

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

  @IsString({ message: 'Head of Service ID must be a string' })
  @IsNotEmpty({ message: 'Head of Service is required' })
  headOfServiceId!: string;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean = true;

  @IsBoolean({ message: 'isWarehouse must be a boolean' })
  @IsOptional()
  isWarehouse?: boolean = false;

  @IsObject({ message: 'Operating hours must be an object' })
  @IsOptional()
  operatingHours?: Record<string, any>; // JSONB format
}

