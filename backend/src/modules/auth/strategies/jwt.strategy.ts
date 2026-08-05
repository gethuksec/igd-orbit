import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getPermissionVersionKey } from '../../../shared/utils/permissions.util';

/**
 * JWT Payload interface
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  username?: string;
  fullName?: string;
  roles: string[];
  permissions?: string[];
  branchIds?: string[];
  permVer?: number; // Permission version (D-PERM) — bump invalidates this token
  iat?: number;
  exp?: number;
}

/**
 * JWT Strategy
 * Validates JWT tokens and extracts user information.
 *
 * D-PERM (2026-08-06): NO database query on the request path.
 * Permissions come from the JWT claims (computed at login with the single
 * merge function) and are validated against the Redis permission version:
 *   - signature valid?
 *   - Redis auth:ver:{userId} == JWT permVer?
 * If an admin changed the user's permissions/roles/active state, the version
 * was bumped → this token is rejected with 401 → client auto-refreshes (T22)
 * and gets a fresh token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject('REDIS_CLIENT') private redis: Redis,
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
    // ── Permission version check (no DB) ─────────────────────────────
    let currentVer: string | null = null;
    try {
      currentVer = await this.redis.get(getPermissionVersionKey(payload.sub));
    } catch (e) {
      // Redis unavailable → fail open (token expiry still applies)
      console.warn('[D-PERM] Redis unavailable during JWT validation:', e);
    }

    // If a version exists in Redis and doesn't match the token's claim,
    // the user's permissions/roles/active state changed since login.
    if (currentVer !== null && String(payload.permVer ?? 0) !== currentVer) {
      throw new UnauthorizedException('Session expired, please sign in again');
    }

    return {
      id: payload.sub,
      email: payload.email,
      fullName: payload.fullName,
      username: payload.username,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      branchIds: payload.branchIds || null,
      permVer: payload.permVer ?? 0,
    };
  }
}
