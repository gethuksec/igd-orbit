import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Loader2 } from 'lucide-react';

interface PermissionRouteProps {
  children: ReactNode;
  /**
   * Required permission(s) to access this route
   * Supports multiple permissions (OR logic)
   * Supports wildcards: 'sales.*.create', 'sales.pos.*'
   */
  permission?: string | string[];
  /**
   * Fallback to role check if permission not available
   * Only used if permission check fails and feature flag is disabled
   */
  fallbackRoles?: string[];
  /**
   * Redirect path when access denied
   * Default: '/unauthorized'
   */
  redirectTo?: string;
}

/**
 * PermissionRoute Component
 * 
 * Protects routes based on user permissions.
 * 
 * Safety: If feature flag is disabled, falls back to role check or allows access.
 * This ensures existing routes continue to work.
 * 
 * @example
 * <Route
 *   path="/sales/pos"
 *   element={
 *     <PermissionRoute permission="sales.pos.view">
 *       <POSPage />
 *     </PermissionRoute>
 *   }
 * />
 */
export default function PermissionRoute({
  children,
  permission,
  fallbackRoles,
  redirectTo = '/unauthorized',
}: PermissionRouteProps) {
  const navigate = useNavigate();
  const { hasAnyPermission, hasAnyRole, userRoles } = usePermissions();

  // SUPERADMIN: Always allow access - full access, no restrictions
  const isSuperAdmin = userRoles.includes('SUPERADMIN');

  useEffect(() => {
    // SUPERADMIN: Bypass all permission checks
    if (isSuperAdmin) {
      return; // Allow access, no need to check permissions
    }

    // If no permission specified, allow access (backward compatible)
    if (!permission) {
      return;
    }

    const permissions = Array.isArray(permission) ? permission : [permission];
    const hasAccess = hasAnyPermission(permissions);

    // If permission check fails, try role fallback
    if (!hasAccess && fallbackRoles && fallbackRoles.length > 0) {
      const hasRoleAccess = hasAnyRole(fallbackRoles);
      if (!hasRoleAccess) {
        navigate(redirectTo, { replace: true });
      }
      return;
    }

    // If permission check fails and no fallback, redirect
    if (!hasAccess) {
      navigate(redirectTo, { replace: true });
    }
  }, [permission, fallbackRoles, hasAnyPermission, hasAnyRole, navigate, redirectTo, isSuperAdmin]);

  // SUPERADMIN: Always allow access - full access, no restrictions
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Check permission
  if (permission) {
    const permissions = Array.isArray(permission) ? permission : [permission];
    const hasAccess = hasAnyPermission(permissions);

    // Try role fallback if permission check fails
    if (!hasAccess && fallbackRoles && fallbackRoles.length > 0) {
      const hasRoleAccess = hasAnyRole(fallbackRoles);
      if (hasRoleAccess) {
        // Role check passed, allow access
        return <>{children}</>;
      }
      // Role check failed, show loading (will redirect in useEffect)
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Checking access...</p>
          </div>
        </div>
      );
    }

    if (!hasAccess) {
      // Permission check failed, show loading (will redirect in useEffect)
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Checking access...</p>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
}

