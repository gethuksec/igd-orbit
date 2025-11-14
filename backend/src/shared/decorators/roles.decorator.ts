import { SetMetadata } from '@nestjs/common';

/**
 * Roles metadata key
 */
export const ROLES_KEY = 'roles';

/**
 * Roles Decorator
 * Used to specify required roles for route access
 * @param roles - Array of role codes (e.g., ['OWNER', 'HS'])
 * @returns Custom decorator
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
