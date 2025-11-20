import { useMemo } from 'react';

/**
 * Get user from localStorage
 */
const getUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) return JSON.parse(userStr);
  } catch {
    // Ignore parse errors
  }
  return null;
};

/**
 * Feature flag: USE_PERMISSION_HOOKS
 * Default: false (disabled for safety)
 */
export const getUsePermissionHooks = () => {
  return import.meta.env.VITE_USE_PERMISSION_HOOKS === 'true' || false;
};

/**
 * usePermissions Hook
 * 
 * Provides permission checking utilities for components.
 * 
 * Safety: If feature flag is disabled, always returns true (backward compatible).
 * This ensures existing components continue to work without permission checks.
 * 
 * @returns Object with permission checking methods
 * 
 * @example
 * const { hasPermission } = usePermissions();
 * if (hasPermission('sales.pos.create')) {
 *   // Show create button
 * }
 */
export function usePermissions() {
  const user = useMemo(() => getUser(), []);

  const userPermissions = useMemo(() => {
    if (!user) return [];
    
    // Support both formats: user.permissions (array) or user.role.permissions
    if (Array.isArray(user.permissions)) {
      return user.permissions;
    }
    
    // Fallback: extract from roles if permissions not directly available
    // This will be populated when backend sends permissions in JWT
    return [];
  }, [user]);

  const userRoles = useMemo(() => {
    if (!user) return [];
    
    // Support both formats: user.roles (array) or user.role.code (single)
    if (Array.isArray(user.roles)) {
      return user.roles;
    }
    if (user.role?.code) {
      return [user.role.code];
    }
    return [];
  }, [user]);

  /**
   * Check if user has a specific permission
   * Supports wildcards: 'sales.*.create', 'sales.pos.*'
   */
  const hasPermission = useMemo(
    () => (permission: string): boolean => {
      // If feature flag disabled, always return true (backward compatible)
      if (!getUsePermissionHooks()) {
        return true;
      }

      if (!permission || userPermissions.length === 0) {
        return false;
      }

      // Exact match
      if (userPermissions.includes(permission)) {
        return true;
      }

      // Check wildcard patterns
      const parts = permission.split('.');
      if (parts.length !== 3) {
        return false; // Invalid format
      }

      const [module, submodule, action] = parts;

      // Check all user permissions for matches
      return userPermissions.some((userPerm: string) => {
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
    },
    [userPermissions],
  );

  /**
   * Check if user has any of the specified permissions (OR logic)
   */
  const hasAnyPermission = useMemo(
    () => (permissions: string[]): boolean => {
      if (!getUsePermissionHooks()) {
        return true; // Backward compatible
      }

      if (!permissions || permissions.length === 0) {
        return true; // No requirements = allowed
      }

      return permissions.some((perm) => hasPermission(perm));
    },
    [hasPermission],
  );

  /**
   * Check if user has all of the specified permissions (AND logic)
   */
  const hasAllPermissions = useMemo(
    () => (permissions: string[]): boolean => {
      if (!getUsePermissionHooks()) {
        return true; // Backward compatible
      }

      if (!permissions || permissions.length === 0) {
        return true; // No requirements = allowed
      }

      return permissions.every((perm) => hasPermission(perm));
    },
    [hasPermission],
  );

  /**
   * Check if user has a specific role
   * Fallback to role check if permission system not available
   */
  const hasRole = useMemo(
    () => (role: string): boolean => {
      return userRoles.includes(role);
    },
    [userRoles],
  );

  /**
   * Check if user has any of the specified roles (OR logic)
   */
  const hasAnyRole = useMemo(
    () => (roles: string[]): boolean => {
      if (!roles || roles.length === 0) {
        return true;
      }

      return roles.some((role) => userRoles.includes(role));
    },
    [userRoles],
  );

  return {
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
    hasAnyRole,
    userPermissions,
    userRoles,
    user,
  };
}

