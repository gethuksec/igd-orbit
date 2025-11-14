import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../shared/services';

/**
 * JWT Payload interface
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  roles: string[];
  permissions?: string[];
  branchIds?: string[];
  iat?: number;
  exp?: number;
}

/**
 * JWT Strategy
 * Validates JWT tokens and extracts user information
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'your-secret-key',
    });
  }

  /**
   * Validate JWT payload and return user data
   * @param payload - JWT payload
   * @returns User object with roles and permissions
   */
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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

    // Extract roles and permissions
    const roles = user.userRoles
      .filter((ur) => !ur.validUntil || ur.validUntil > new Date())
      .map((ur) => ur.role.code);

    const permissions = user.userRoles
      .flatMap((ur) => ur.role.rolePermissions)
      .map(
        (rp) =>
          `${rp.permission.module}.${rp.permission.submodule || '*'}.${rp.permission.action}`,
      )
      .filter((p, index, self) => self.indexOf(p) === index); // Remove duplicates

    const branchIds = user.userRoles
      .map((ur) => ur.branchId)
      .filter((id): id is string => id !== null);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      roles,
      permissions,
      branchIds: branchIds.length > 0 ? branchIds : null, // null means all branches
    };
  }
}
