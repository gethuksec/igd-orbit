import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';

// Helper to get user from localStorage
const getUser = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) return JSON.parse(userStr);
  } catch {
    // Ignore
  }
  return null;
};

interface ProtectedRouteProps {
  children: ReactNode;
}

// Map route paths to module permissions
const routeToModulePermission: Record<string, string> = {
  '/dashboard': 'dashboard.*.view',
  '/customers': 'master_data.*.view',
  '/products': 'master_data.*.view',
  '/suppliers': 'master_data.*.view',
  '/categories': 'master_data.*.view',
  '/brands': 'master_data.*.view',
  '/colors': 'master_data.*.view',
  '/units': 'master_data.*.view',
  '/sizes': 'master_data.*.view',
  '/expeditions': 'master_data.*.view',
  '/sales-types': 'master_data.*.view',
  '/service-types': 'master_data.*.view',
  '/sales': 'sales.*.view',
  '/pos': 'sales.*.view',
  '/sales/history': 'sales.*.view',
  '/sales/returns': 'sales.*.view',
  '/service-orders': 'service.*.view',
  '/service-returns': 'service.*.view',
  '/inventory': 'inventory.*.view',
  '/inventory/stock': 'inventory.*.view',
  '/inventory/transfer': 'inventory.*.view',
  '/inventory/opname': 'inventory.*.view',
  '/inventory/adjustment': 'inventory.*.view',
  '/inventory/movements': 'inventory.*.view',
  '/inventory/alerts': 'inventory.*.view',
  '/finance': 'finance.*.view',
  '/finance/coa': 'finance.*.view',
  '/finance/journal': 'finance.*.view',
  '/finance/expenses': 'finance.*.view',
  '/finance/petty-cash': 'finance.*.view',
  '/finance/ar': 'finance.*.view',
  '/finance/reports': 'finance.*.view',
  '/hr': 'hr.*.view',
  '/hr/employees': 'hr.*.view',
  '/hr/departments': 'hr.*.view',
  '/hr/attendance': 'hr.*.view',
  '/hr/leave': 'hr.*.view',
  '/hr/payroll': 'hr.*.view',
  '/hr/kpi': 'hr.*.view',
  '/purchasing': 'purchasing.*.view',
  '/purchasing/suppliers': 'purchasing.*.view',
  '/purchasing/po': 'purchasing.*.view',
  '/purchasing/goods-receipt': 'purchasing.*.view',
  '/users': 'users.*.view',
  '/roles': 'roles.*.view',
  '/branches': 'master_data.*.view',
  '/profile': 'dashboard.*.view', // Profile accessible if user has dashboard access
  '/settings': 'dashboard.*.view', // Settings accessible if user has dashboard access
};

// Helper function to get module permission from path
function getModulePermissionFromPath(pathname: string): string | null {
  // Check exact match first
  if (routeToModulePermission[pathname]) {
    return routeToModulePermission[pathname];
  }

  // Check prefix match (for nested routes)
  for (const [route, permission] of Object.entries(routeToModulePermission)) {
    if (pathname.startsWith(route)) {
      return permission;
    }
  }

  // Default: require dashboard access for unknown routes
  return 'dashboard.*.view';
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = usePermissions();

  // Get required module permission for current route
  const requiredPermission = useMemo(
    () => getModulePermissionFromPath(location.pathname),
    [location.pathname],
  );

  // Get user from localStorage to check if permissions exist
  const user = useMemo(() => getUser(), []);

  // Get user roles to check if SUPERADMIN
  const userRoles = useMemo(() => {
    if (!user) return [];
    if (Array.isArray(user.roles)) {
      return user.roles;
    }
    if (user.role?.code) {
      return [user.role.code];
    }
    return [];
  }, [user]);

  // SUPERADMIN: Bypass all permission checks - full access
  const isSuperAdmin = useMemo(() => {
    return userRoles.includes('SUPERADMIN');
  }, [userRoles]);

  // Check if user has permissions array (indicating permission system is active)
  // If permissions array is empty, it means permissions are not assigned yet (seed not run)
  // If permissions array is non-empty, check access
  // If no permissions property, allow access (backward compatible)
  const hasPermissionsInUser = useMemo(() => {
    if (!user) return false;
    // Check if permissions property exists (even if empty)
    return 'permissions' in user && Array.isArray(user.permissions);
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/login');
      return;
    }

    // SUPERADMIN: Bypass all permission checks - full access
    if (isSuperAdmin) {
      return; // Allow access, no need to check permissions
    }

    // Only check permission if user has permissions property AND permissions array is not empty
    // If permissions array is empty, it means permissions not seeded yet - allow access
    // If no permissions property, allow access (backward compatible)
    if (requiredPermission && hasPermissionsInUser) {
      const userPermissions = user?.permissions || [];
      // Only enforce permission check if permissions array is not empty
      if (userPermissions.length > 0) {
        const hasAccess = hasPermission(requiredPermission);
        
        if (!hasAccess) {
          // Redirect to unauthorized page
          console.warn(`Access denied: No permission for ${requiredPermission} (route: ${location.pathname})`);
          console.warn('User permissions:', userPermissions);
          navigate('/unauthorized', { replace: true });
        }
      }
      // If permissions array is empty, allow access (permissions not seeded yet)
    }
  }, [navigate, location.pathname, requiredPermission, hasPermission, hasPermissionsInUser, isSuperAdmin, user]);

  const token = localStorage.getItem('access_token');
  if (!token) {
    return null;
  }

  // SUPERADMIN: Bypass all permission checks - full access
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Check permission before rendering (only if permissions exist and not empty)
  if (requiredPermission && hasPermissionsInUser) {
    const userPermissions = user?.permissions || [];
    // Only enforce permission check if permissions array is not empty
    if (userPermissions.length > 0) {
      const hasAccess = hasPermission(requiredPermission);
      
      if (!hasAccess) {
        // Show loading while redirecting (handled in useEffect)
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <p className="text-gray-600">Checking access...</p>
            </div>
          </div>
        );
      }
    }
    // If permissions array is empty, allow access (permissions not seeded yet)
  }

  return <>{children}</>;
}

