import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

interface RequirePermissionProps {
  children: ReactNode;
  /**
   * Required permission(s) to show children
   * Supports multiple permissions (OR logic)
   * Supports wildcards: 'sales.*.create', 'sales.pos.*'
   */
  permission?: string | string[];
  /**
   * Fallback to role check if permission not available
   */
  fallbackRoles?: string[];
  /**
   * Show fallback content when permission denied
   */
  fallback?: ReactNode;
  /**
   * If true, hide component instead of showing fallback
   */
  hideOnDeny?: boolean;
}

/**
 * RequirePermission Component
 * 
 * Conditionally renders children based on user permissions.
 * 
 * Safety: If feature flag is disabled, always shows children (backward compatible).
 * This ensures existing components continue to work.
 * 
 * @example
 * <RequirePermission permission="sales.pos.create">
 *   <Button>Create Transaction</Button>
 * </RequirePermission>
 * 
 * @example
 * <RequirePermission 
 *   permission="sales.pos.delete"
 *   fallback={<span className="text-gray-400">No permission</span>}
 * >
 *   <Button variant="danger">Delete</Button>
 * </RequirePermission>
 */
export default function RequirePermission({
  children,
  permission,
  fallbackRoles,
  fallback = null,
  hideOnDeny = false,
}: RequirePermissionProps) {
  const { hasAnyPermission, hasAnyRole } = usePermissions();

  // If no permission specified, show children (backward compatible)
  if (!permission) {
    return <>{children}</>;
  }

  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAccess = hasAnyPermission(permissions);

  // If permission check fails, try role fallback
  if (!hasAccess && fallbackRoles && fallbackRoles.length > 0) {
    const hasRoleAccess = hasAnyRole(fallbackRoles);
    if (hasRoleAccess) {
      return <>{children}</>;
    }
  }

  // If has access, show children
  if (hasAccess) {
    return <>{children}</>;
  }

  // If hideOnDeny, return null
  if (hideOnDeny) {
    return null;
  }

  // Otherwise, show fallback
  return <>{fallback}</>;
}

