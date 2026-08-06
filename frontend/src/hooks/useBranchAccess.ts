import { useMemo } from 'react';
import { useBranchStore } from '@/stores/branchStore';

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
 * Feature flag: USE_BRANCH_ACCESS_HOOKS
 * Default: false (disabled for safety)
 */
const getUseBranchAccessHooks = () => {
  return import.meta.env.VITE_USE_BRANCH_ACCESS_HOOKS === 'true' || false;
};

/**
 * useBranchAccess Hook
 * 
 * Provides branch access checking utilities for components.
 * 
 * Safety: If feature flag is disabled, always returns true (backward compatible).
 * This ensures existing components continue to work without branch restrictions.
 * 
 * @returns Object with branch access checking methods
 * 
 * @example
 * const { canAccessBranch } = useBranchAccess();
 * if (canAccessBranch('branch-1')) {
 *   // Show branch-specific content
 * }
 */
export function useBranchAccess() {
  const user = useMemo(() => getUser(), []);
  const { availableBranches } = useBranchStore();

  const accessibleBranchIds = useMemo(() => {
    if (!getUseBranchAccessHooks()) {
      return null; // null = all branches (backward compatible)
    }

    if (!user) {
      return [];
    }

    // Get branch IDs from user roles
    // Format: user.branchIds (array) or extract from userRoles
    if (Array.isArray(user.branchIds)) {
      // If null in array, means global access
      if (user.branchIds.includes(null)) {
        return null; // Global access
      }
      return user.branchIds.filter((id: string | null): id is string => id !== null);
    }

    // Fallback: if no branchIds, assume global access (backward compatible)
    // This will be populated when backend sends branchIds in JWT
    return null;
  }, [user]);

  /**
   * Check if user can access a specific branch
   */
  const canAccessBranch = useMemo(
    () => (branchId: string | null): boolean => {
      if (!getUseBranchAccessHooks()) {
        return true; // Backward compatible
      }

      // null means global access
      if (accessibleBranchIds === null) {
        return true;
      }

      if (!branchId) {
        return true; // No branch specified = allowed
      }

      return accessibleBranchIds.includes(branchId);
    },
    [accessibleBranchIds],
  );

  /**
   * Get list of accessible branch IDs
   * Returns null if user has global access
   */
  const getAccessibleBranchIds = useMemo(
    () => (): string[] | null => {
      if (!getUseBranchAccessHooks()) {
        return null; // Global access (backward compatible)
      }

      return accessibleBranchIds;
    },
    [accessibleBranchIds],
  );

  /**
   * Get accessible branches (full branch objects)
   */
  const getAccessibleBranches = useMemo(
    () => () => {
      if (!getUseBranchAccessHooks()) {
        return availableBranches; // Return all (backward compatible)
      }

      if (accessibleBranchIds === null) {
        return availableBranches; // Global access = all branches
      }

      return availableBranches.filter((branch) =>
        accessibleBranchIds.includes(branch.id),
      );
    },
    [accessibleBranchIds, availableBranches],
  );

  /**
   * Filter data by branch access
   */
  const filterByBranchAccess = useMemo(
    () => <T extends { branchId?: string | null }>(data: T[]): T[] => {
      if (!getUseBranchAccessHooks()) {
        return data; // Return all (backward compatible)
      }

      if (accessibleBranchIds === null) {
        return data; // Global access = all data
      }

      // Filter: include items with null branchId OR items with accessible branchId
      return data.filter(
        (item) => item.branchId === null || item.branchId === undefined || accessibleBranchIds.includes(item.branchId),
      );
    },
    [accessibleBranchIds],
  );

  /**
   * D7 (#62): global currentBranchId is gone — there is no "current branch"
   * to check anymore. Kept as always-true for API compatibility.
   */
  const isCurrentBranchAccessible = useMemo(() => true, []);

  return {
    canAccessBranch,
    getAccessibleBranchIds,
    getAccessibleBranches,
    filterByBranchAccess,
    isCurrentBranchAccessible,
    accessibleBranchIds,
    hasGlobalAccess: accessibleBranchIds === null,
  };
}

