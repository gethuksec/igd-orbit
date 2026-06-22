import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../shared/guards';
import {
  LoginDto,
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ChangePasswordDto,
} from './dto';

/**
 * Auth Controller
 * Handles authentication endpoints
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Login endpoint
   * POST /api/v1/auth/login
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    try {
      return await this.authService.login(loginDto);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Register endpoint
   * POST /api/v1/auth/register
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Logout endpoint
   * POST /api/v1/auth/logout
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: ExpressRequest & { user: { id: string } }) {
    await this.authService.logout(req.user.id);
    return { message: 'Logged out successfully' };
  }

  /**
   * Refresh token endpoint
   * POST /api/v1/auth/refresh
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  /**
   * Forgot password endpoint
   * POST /api/v1/auth/forgot-password
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    await this.authService.forgotPassword(forgotPasswordDto);
    return {
      message:
        'If the email exists, a password reset link has been sent to your email',
    };
  }

  /**
   * Reset password endpoint
   * POST /api/v1/auth/reset-password
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    await this.authService.resetPassword(resetPasswordDto);
    return { message: 'Password reset successfully' };
  }

  /**
   * Change password endpoint
   * POST /api/v1/auth/change-password
   * Requires authentication
   * Checks Role.level for auto-approval
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Body() changePasswordDto: ChangePasswordDto,
    @Request() req: ExpressRequest & { user: { id: string } },
  ) {
    return this.authService.changePassword(req.user.id, changePasswordDto);
  }

  /**
   * Get current user profile
   * GET /api/v1/auth/me
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(
    @Request() req: ExpressRequest & { user: { id: string } },
  ) {
    return this.authService.getCurrentUser(req.user.id);
  }

  /**
   * Get pending password change requests
   * GET /api/v1/auth/password-requests/pending
   */
  @Get('password-requests/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingPasswordRequests() {
    return this.authService.getPendingPasswordRequests();
  }

  /**
   * Approve a pending password change request
   * POST /api/v1/auth/password-requests/:id/approve
   */
  @Post('password-requests/:id/approve')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async approvePasswordRequest(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: { id: string } },
  ) {
    return this.authService.approvePasswordRequest(id, req.user.id);
  }

  /**
   * Reject a pending password change request
   * POST /api/v1/auth/password-requests/:id/reject
   */
  @Post('password-requests/:id/reject')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async rejectPasswordRequest(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: { id: string } },
  ) {
    return this.authService.rejectPasswordRequest(id, req.user.id);
  }
}
