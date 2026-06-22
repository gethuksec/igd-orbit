import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  Matches,
  IsUUID,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';

/**
 * Update User DTO
 * Validates user update request payload
 * All fields are optional
 */
export class UpdateUserDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsOptional()
  email?: string;

  @IsString({ message: 'Username must be a string' })
  @IsOptional()
  username?: string;

  @IsString({ message: 'Password must be a string' })
  @IsOptional()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[a-z]/, {
    message: 'Password must contain at least one lowercase letter',
  })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  @Matches(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, {
    message: 'Password must contain at least one special character',
  })
  password?: string;

  @IsString({ message: 'Full name must be a string' })
  @IsOptional()
  fullName?: string;

  @IsString({ message: 'Phone must be a string' })
  @IsOptional()
  @Matches(
    /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/,
    {
      message: 'Phone must be a valid phone number',
    },
  )
  phone?: string;

  @IsString({ message: 'Employee code must be a string' })
  @IsOptional()
  employeeCode?: string;

  @IsUUID('4', { message: 'Department ID must be a valid UUID' })
  @IsOptional()
  departmentId?: string;

  @IsUUID('4', { message: 'Branch ID must be a valid UUID' })
  @IsOptional()
  branchId?: string;

  @IsString({ message: 'Position must be a string' })
  @IsOptional()
  position?: string;

  @IsDateString()
  @IsOptional()
  hireDate?: string;

  @IsEnum(['full-time', 'part-time', 'contract'], {
    message: 'Employment type must be full-time, part-time, or contract',
  })
  @IsOptional()
  employmentType?: 'full-time' | 'part-time' | 'contract';

  @IsNumber({}, { message: 'Basic salary must be a number' })
  @Min(0, { message: 'Basic salary cannot be negative' })
  @IsOptional()
  basicSalary?: number;

  @IsNumber({}, { message: 'Hourly rate must be a number' })
  @Min(0, { message: 'Hourly rate cannot be negative' })
  @IsOptional()
  hourlyRate?: number;

  @IsString({ message: 'Bank account must be a string' })
  @IsOptional()
  bankAccount?: string;

  @IsString({ message: 'Bank name must be a string' })
  @IsOptional()
  bankName?: string;

  @IsString({ message: 'Tax ID must be a string' })
  @IsOptional()
  taxId?: string;

  @IsString({ message: 'BPJS number must be a string' })
  @IsOptional()
  bpjsNumber?: string;

  @IsBoolean({ message: 'isActive must be a boolean' })
  @IsOptional()
  isActive?: boolean;

  @IsBoolean({ message: 'canChangePassword must be a boolean' })
  @IsOptional()
  canChangePassword?: boolean;
}
