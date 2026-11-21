import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Login DTO
 * Validates login request payload.
 * IGDERP-275: `email` accepts an email address OR employee NIK.
 */
export class LoginDto {
  @IsString({ message: 'Email or NIK must be a string' })
  @IsNotEmpty({ message: 'Email or NIK is required' })
  email!: string;

  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(1, { message: 'Password cannot be empty' })
  password!: string;
}
