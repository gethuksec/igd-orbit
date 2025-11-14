import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * Forgot Password DTO
 * Validates forgot password request payload
 */
export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;
}
