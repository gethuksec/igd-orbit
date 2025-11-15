import { SetMetadata } from '@nestjs/common';

/**
 * Public decorator
 * Marks a route as public (no authentication required)
 * Used with JwtAuthGuard to bypass authentication
 */
export const Public = () => SetMetadata('isPublic', true);

