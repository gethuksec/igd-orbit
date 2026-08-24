import { ForbiddenException } from '@nestjs/common';

/**
 * Roles that can see every branch (no branch scoping).
 */
const GLOBAL_ROLES = ['SUPERADMIN', 'OWNER', 'CFO'];

export interface BranchFilter {
  /** A specific branch the caller may read (enforced against user access). */
  branchId?: string;
  /** All branches the caller may read — used when no specific branch was requested. */
  branchIds?: string[];
  /** True for global roles (SUPERADMIN/OWNER/CFO): no branch restriction at all. */
  all: boolean;
}

/**
 * Resolve the branch scope for list/read endpoints.
 *
 * Client decision (meeting 22 Agu 2026, §1 Filter Cabang/Outlet):
 * - User with 1 branch → auto-select that branch (FE handles the default).
 * - User with >1 branch → "Semua Cabang" is the default → list endpoints must
 *   return data across ALL branches the user can access (IN userBranchIds),
 *   never fall back to the first branch.
 * - Branches the user has no access to are never returned.
 *
 * Returns:
 * - { branchId, all: true }            → global role, optional explicit branch
 * - { branchId, all: false }           → non-global, explicit allowed branch
 * - { branchIds, all: false }          → non-global, no branch → all accessible branches
 */
export function resolveBranchFilter(
  req: { user?: any },
  branchId?: string,
): BranchFilter {
  const userBranchIds: string[] = req?.user?.branchIds;
  const userRoles: string[] = req?.user?.roles || [];

  const isGlobalRole = userRoles.some((role) => GLOBAL_ROLES.includes(role));

  // Global roles can access any / all branches
  if (isGlobalRole) {
    return { branchId, all: true };
  }

  // null/undefined branchIds means all branches (e.g. no branch assignment)
  if (userBranchIds === null || userBranchIds === undefined) {
    return { branchId, all: true };
  }

  if (!Array.isArray(userBranchIds) || userBranchIds.length === 0) {
    throw new ForbiddenException('You do not have any branch access.');
  }

  // If a specific branch is requested, ensure it is allowed
  if (branchId) {
    if (!userBranchIds.includes(branchId)) {
      throw new ForbiddenException('You do not have access to this branch.');
    }
    return { branchId, all: false };
  }

  // No branch specified → all accessible branches (client decision 22-Agu-2026)
  return { branchIds: userBranchIds, all: false };
}
