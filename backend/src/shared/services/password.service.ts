import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

/**
 * Password Service
 * Handles password hashing, verification, and reset token generation
 */
@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 10;

  /**
   * Hash a plain text password using bcrypt
   * @param plainPassword - Plain text password to hash
   * @returns Hashed password
   */
  async hashPassword(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, this.SALT_ROUNDS);
  }

  /**
   * Compare plain password with hashed password
   * @param plainPassword - Plain text password
   * @param hashedPassword - Hashed password to compare against
   * @returns True if passwords match, false otherwise
   */
  async comparePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Generate a secure random token for password reset
   * @param length - Token length in bytes (default: 32)
   * @returns Hexadecimal token string
   */
  generateResetToken(length: number = 32): string {
    return randomBytes(length).toString('hex');
  }

  /**
   * Validate password strength
   * Requirements:
   * - Minimum 8 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one number
   * - At least one special character
   * @param password - Password to validate
   * @returns Object with isValid flag and error message if invalid
   */
  validatePasswordStrength(password: string): {
    isValid: boolean;
    error?: string;
  } {
    if (password.length < 8) {
      return {
        isValid: false,
        error: 'Password must be at least 8 characters long',
      };
    }

    if (!/[A-Z]/.test(password)) {
      return {
        isValid: false,
        error: 'Password must contain at least one uppercase letter',
      };
    }

    if (!/[a-z]/.test(password)) {
      return {
        isValid: false,
        error: 'Password must contain at least one lowercase letter',
      };
    }

    if (!/[0-9]/.test(password)) {
      return {
        isValid: false,
        error: 'Password must contain at least one number',
      };
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return {
        isValid: false,
        error: 'Password must contain at least one special character',
      };
    }

    return { isValid: true };
  }
}
