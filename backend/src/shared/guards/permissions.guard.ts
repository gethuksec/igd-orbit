import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PERMISSIONS_KEY } from '../decorators';

/**
 * Permissions Guard
 * Checks if user has required permission(s) to access route
 * 
 * This guard is OPTIONAL and works alongside RolesGuard.
 * It only activates if @Permissions() decorator is present.
 * 
 * Feature Flag: USE_PERMISSION_GUARD (default: false)
 * - If disabled, guard always returns true (skip permission check)
 * - If enabled, checks permissions as specified
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly usePermissionGuard: boolean;

  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {
    // Feature flag: default to false (disabled) for safety
    this.usePermissionGuard =
      this.configService.get<string>('USE_PERMISSION_GUARD') === 'true';
  }

  /**
   * Check if user has required permissions
   * @param context - Execution context
   * @returns True if user has required permission or guard is disabled, throws ForbiddenException otherwise
   */
  canActivate(context: ExecutionContext): boolean {
    // If feature flag is disabled, skip permission check (backward compatible)
    if (!this.usePermissionGuard) {
      return true;
    }

    // Get required permissions from decorator
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no @Permissions() decorator, allow access (guard is optional)
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    const userPermissions = user.permissions || [];

    // Check if user has any of the required permissions (OR logic)
    const hasPermission = requiredPermissions.some((requiredPerm) =>
      this.checkPermission(userPermissions, requiredPerm),
    );

    if (!hasPermission) {
      const errorMessage = `Access denied. Required permissions: ${requiredPermissions.join(', ')}`;
      const exception = new ForbiddenException(errorMessage);
      (exception as any).requiredPermissions = requiredPermissions;
      throw exception;
    }

    return true;
  }

  /**
   * Check if user has a specific permission (supports wildcards)
   * @param userPermissions - Array of user permissions
   * @param requiredPermission - Required permission (may contain wildcards)
   * @returns True if user has the permission
   */
  private checkPermission(
    userPermissions: string[],
    requiredPermission: string,
  ): boolean {
    // Exact match
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // Check wildcard patterns
    // Pattern: "module.*.action" or "module.submodule.*"
    const parts = requiredPermission.split('.');
    if (parts.length !== 3) {
      return false; // Invalid format
    }

    const [module, submodule, action] = parts;

    // Check all user permissions for matches
    return userPermissions.some((userPerm) => {
      const userParts = userPerm.split('.');
      if (userParts.length !== 3) {
        return false;
      }

      const [userModule, userSubmodule, userAction] = userParts;

      // Match module
      if (module !== '*' && module !== userModule) {
        return false;
      }

      // Match submodule
      if (submodule !== '*' && submodule !== userSubmodule) {
        return false;
      }

      // Match action
      if (action !== '*' && action !== userAction) {
        return false;
      }

      return true;
    });
  }
}

