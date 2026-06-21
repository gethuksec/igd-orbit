import {
  Injectable,
  Inject,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/services';
import { PasswordService } from '../../shared/services';
import {
  LoginDto,
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto';
import { JwtPayload } from './strategies/jwt.strategy';
import Redis from 'ioredis';

/**
 * Auth Service
 * Handles authentication, authorization, and user management
 */
@Injectable()
export class AuthService {
  private readonly refreshTokenPrefix = 'refresh_token:';
  private readonly resetTokenPrefix = 'reset_token:';

  constructor(
    private prisma: PrismaService,
    private passwordService: PasswordService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Validate user credentials
   * @param email - User email
   * @param password - Plain text password
   * @returns User object if valid, null otherwise
   */
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Check if user is banned due to failed login attempts
    if (!user.isActive && user.banReason === 'failed_logins') {
      throw new UnauthorizedException(
        'Account banned due to 3 failed login attempts. Contact your supervisor to reactivate.',
      );
    }

    // Check if user is active and not deleted
    if (!user.isActive || user.deletedAt) {
      throw new UnauthorizedException('Account is inactive or deleted');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Account is locked until ${user.lockedUntil.toISOString()}`,
      );
    }

    // Verify password
    const isPasswordValid = await this.passwordService.comparePassword(
      password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      // Increment failed login attempts
      const failedAttempts = user.failedLoginAttempts + 1;
      const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
        failedLoginAttempts: failedAttempts,
      };

      // Ban account after 3 failed attempts (permanent - supervisor must reactivate)
      if (failedAttempts >= 3) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            isActive: false,
            failedLoginAttempts: 0,
            lockedUntil: null,
            banReason: 'failed_logins',
          },
        });
        throw new UnauthorizedException(
          'Account banned due to 3 failed login attempts. Contact your supervisor to reactivate.',
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: updateData,
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    // Reset failed login attempts on successful login
    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
        },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    }

    return user;
  }

  /**
   * Login user and generate JWT tokens
   * @param loginDto - Login credentials
   * @returns Access token, refresh token, and user data
   */
  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Get user roles and permissions
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId: user.id,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const roles = userRoles.map((ur) => ur.role.code);
    const branchIds = userRoles
      .map((ur) => ur.branchId)
      .filter((id): id is string => id !== null);

    const permissions = userRoles
      .flatMap((ur) => ur.role.rolePermissions)
      .map(
        (rp) =>
          `${rp.permission.module}.${rp.permission.submodule || '*'}.${rp.permission.action}`,
      )
      .filter((p, index, self) => self.indexOf(p) === index);

    // Generate JWT payload
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions,
      branchIds: branchIds.length > 0 ? branchIds : undefined,
    };

    // Generate access token (1 hour)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('jwt.expiresIn') || '1h',
    });

    // Generate refresh token (7 days)
    const refreshToken = this.passwordService.generateResetToken(64);
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '7d';

    // Store refresh token in Redis (with error handling)
    const refreshTokenKey = `${this.refreshTokenPrefix}${user.id}`;
    try {
      await this.redis.set(
        refreshTokenKey,
        refreshToken,
        'EX',
        this.parseExpiration(refreshExpiresIn),
      );
    } catch (error) {
      // Log Redis error but don't fail login if Redis is unavailable
      console.warn('Redis unavailable, refresh token not stored:', error);
      // Continue with login - refresh token will still be returned but won't be stored
    }

    // Get primary role for user object
    const primaryRole = userRoles.find((ur) => ur.isPrimary) || userRoles[0];
    const role = primaryRole?.role;

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        profilePhotoUrl: user.profilePhotoUrl,
        roles,
        role: role
          ? {
              id: role.id,
              code: role.code,
              name: role.name,
              level: role.level,
            }
          : null,
        permissions,
        branchIds: branchIds.length > 0 ? branchIds : null,
      },
    };
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - Refresh token
   * @returns New access token
   */
  async refreshToken(refreshToken: string) {
    // Find user by refresh token in Redis
    const keys = await this.redis.keys(`${this.refreshTokenPrefix}*`);
    let userId: string | null = null;

    for (const key of keys) {
      const storedToken = await this.redis.get(key);
      if (storedToken === refreshToken) {
        userId = key.replace(this.refreshTokenPrefix, '');
        break;
      }
    }

    if (!userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Get active roles
    const activeRoles = user.userRoles.filter(
      (ur) => !ur.validUntil || ur.validUntil > new Date(),
    );

    const roles = activeRoles.map((ur) => ur.role.code);
    const branchIds = activeRoles
      .map((ur) => ur.branchId)
      .filter((id): id is string => id !== null);

    const permissions = activeRoles
      .flatMap((ur) => ur.role.rolePermissions)
      .map(
        (rp) =>
          `${rp.permission.module}.${rp.permission.submodule || '*'}.${rp.permission.action}`,
      )
      .filter((p, index, self) => self.indexOf(p) === index);

    // Generate new access token
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles,
      permissions,
      branchIds: branchIds.length > 0 ? branchIds : undefined,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('jwt.expiresIn') || '1h',
    });

    return { accessToken };
  }

  /**
   * Logout user by removing refresh token
   * @param userId - User ID
   */
  async logout(userId: string): Promise<void> {
    const refreshTokenKey = `${this.refreshTokenPrefix}${userId}`;
    await this.redis.del(refreshTokenKey);
  }

  /**
   * Register new user
   * @param registerDto - Registration data
   * @returns Created user (without password)
   */
  async register(registerDto: RegisterDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Check if username already exists (if provided)
    if (registerDto.username) {
      const existingUsername = await this.prisma.user.findUnique({
        where: { username: registerDto.username },
      });

      if (existingUsername) {
        throw new BadRequestException('Username already taken');
      }
    }

    // Validate password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(
      registerDto.password,
    );
    if (!passwordValidation.isValid) {
      throw new BadRequestException(passwordValidation.error);
    }

    // Hash password
    const passwordHash = await this.passwordService.hashPassword(
      registerDto.password,
    );

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: registerDto.email,
        username: registerDto.username,
        passwordHash,
        fullName: registerDto.fullName,
        phone: registerDto.phone,
        isActive: true,
        isVerified: false,
      },
    });

    // Return user without password
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Initiate password reset process
   * @param forgotPasswordDto - Email for password reset
   */
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: forgotPasswordDto.email },
    });

    if (!user) {
      // Don't reveal if email exists or not (security best practice)
      return;
    }

    // Generate reset token
    const resetToken = this.passwordService.generateResetToken(64);
    const resetTokenKey = `${this.resetTokenPrefix}${resetToken}`;

    // Store reset token in Redis (expires in 1 hour)
    await this.redis.set(resetTokenKey, user.id, 'EX', 3600);

    // TODO: Send email with reset link
    // For now, we'll just log it (in production, use email service)
    console.log(`Password reset token for ${user.email}: ${resetToken}`);
    // In production: await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  /**
   * Reset password using reset token
   * @param resetPasswordDto - Reset token and new password
   */
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const resetTokenKey = `${this.resetTokenPrefix}${resetPasswordDto.token}`;
    const userId = await this.redis.get(resetTokenKey);

    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Validate password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(
      resetPasswordDto.password,
    );
    if (!passwordValidation.isValid) {
      throw new BadRequestException(passwordValidation.error);
    }

    // Hash new password
    const passwordHash = await this.passwordService.hashPassword(
      resetPasswordDto.password,
    );

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Delete reset token
    await this.redis.del(resetTokenKey);

    // Invalidate all refresh tokens for security
    const refreshTokenKey = `${this.refreshTokenPrefix}${userId}`;
    await this.redis.del(refreshTokenKey);
  }

  /**
   * Get current user profile
   * @param userId - User ID
   * @returns User profile with roles and permissions
   */
  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const activeRoles = user.userRoles.filter(
      (ur) => !ur.validUntil || ur.validUntil > new Date(),
    );

    const roles = activeRoles.map((ur) => ur.role.code);
    const branchIds = activeRoles
      .map((ur) => ur.branchId)
      .filter((id): id is string => id !== null);

    const permissions = activeRoles
      .flatMap((ur) => ur.role.rolePermissions)
      .map(
        (rp) =>
          `${rp.permission.module}.${rp.permission.submodule || '*'}.${rp.permission.action}`,
      )
      .filter((p, index, self) => self.indexOf(p) === index);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      profilePhotoUrl: user.profilePhotoUrl,
      isActive: user.isActive,
      isVerified: user.isVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      roles,
      permissions,
      branchIds: branchIds.length > 0 ? branchIds : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Parse expiration string to seconds
   * @param expiration - Expiration string (e.g., '1h', '7d', '30m')
   * @returns Seconds
   */

  /**
   * Change user password (with role-level approval)
   * Checks Role.level to determine if auto-approve or requires approval
   * - SUPERADMIN (level 0) and OWNER (level 1): auto-approved
   * - Other roles: creates a pending request
   * @param userId - User ID
   * @param changePasswordDto - Current and new password
   * @returns Result with status and message
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    // Get user with roles
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Verify current password
    const isCurrentPasswordValid = await this.passwordService.comparePassword(
      changePasswordDto.currentPassword,
      user.passwordHash,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate new password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(
      changePasswordDto.newPassword,
    );
    if (!passwordValidation.isValid) {
      throw new BadRequestException(passwordValidation.error);
    }

    // Check user's highest role level
    const activeRoles = user.userRoles.filter(
      (ur) => !ur.validUntil || ur.validUntil > new Date(),
    );
    const maxRoleLevel = activeRoles.length > 0
      ? Math.min(...activeRoles.map((ur) => ur.role.level))
      : 999;

    // Hash the new password
    const newPasswordHash = await this.passwordService.hashPassword(
      changePasswordDto.newPassword,
    );

    // SUPERADMIN (level 0) and OWNER (level 1) can change directly
    if (maxRoleLevel <= 1) {
      // Auto-approve: update password directly and create approved request
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      await this.prisma.passwordChangeRequest.create({
        data: {
          userId,
          currentPassword: '*****', // Don't store actual password
          newPasswordHash,
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
        },
      });

      // Invalidate all refresh tokens for security
      const refreshTokenKey = `${this.refreshTokenPrefix}${userId}`;
      try {
        await this.redis.del(refreshTokenKey);
      } catch (error) {
        console.warn('Redis unavailable during password change:', error);
      }

      return {
        status: 'approved',
        message: 'Password changed successfully',
      };
    }

    // For other roles, create a pending request that needs approval
    await this.prisma.passwordChangeRequest.create({
      data: {
        userId,
        currentPassword: '*****', // Don't store actual password
        newPasswordHash,
        status: 'pending',
      },
    });

    return {
      status: 'pending',
      message: 'Password change request submitted and requires approval',
    };
  }

  private parseExpiration(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 3600; // Default 1 hour
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 3600;
    }
  }
}
