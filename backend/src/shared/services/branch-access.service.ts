import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';

/**
 * Branch Access Service
 * Centralized service for checking and filtering branch access
 * 
 * This service helps ensure users can only access data from their assigned branches.
 * 
 * Safety: This service does NOT modify existing queries, it only provides helper methods.
 * Existing services can optionally use these methods.
 */
@Injectable()
export class BranchAccessService {
  constructor(private prisma: PrismaService) {}

  /**
   * Check if user can access a specific branch
   * @param userId - User ID
   * @param branchId - Branch ID to check
   * @returns True if user can access the branch, false otherwise
   */
  async canAccessBranch(userId: string, branchId: string): Promise<boolean> {
    const accessibleBranchIds = await this.getAccessibleBranchIds(userId);

    // If null, user has access to all branches
    if (accessibleBranchIds === null) {
      return true;
    }

    return accessibleBranchIds.includes(branchId);
  }

  /**
   * Get list of branch IDs that user can access
   * @param userId - User ID
   * @returns Array of branch IDs, or null if user has access to all branches
   */
  async getAccessibleBranchIds(userId: string): Promise<string[] | null> {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        // Only active roles (not expired)
        OR: [
          { validUntil: null },
          { validUntil: { gt: new Date() } },
        ],
      },
      include: {
        role: true,
      },
    });

    if (userRoles.length === 0) {
      return []; // No roles = no access
    }

    // Check if any role has global access (branchId is null)
    const hasGlobalAccess = userRoles.some((ur) => ur.branchId === null);

    if (hasGlobalAccess) {
      // User has global access (all branches)
      return null;
    }

    // Get unique branch IDs from user roles
    const branchIds = userRoles
      .map((ur) => ur.branchId)
      .filter((id): id is string => id !== null);

    // Remove duplicates
    return [...new Set(branchIds)];
  }

  /**
   * Filter Prisma query by branch access
   * This is a helper method that adds branch filter to where clause
   * 
   * @param userId - User ID
   * @param whereClause - Existing where clause
   * @returns Modified where clause with branch filter, or original if global access
   */
  async filterByBranchAccess<T extends Prisma.JsonObject>(
    userId: string,
    whereClause: T,
  ): Promise<T> {
    const branchIds = await this.getAccessibleBranchIds(userId);

    // If null, user has access to all branches - no filter needed
    if (branchIds === null) {
      return whereClause;
    }

    // If empty array, user has no branch access - return impossible condition
    if (branchIds.length === 0) {
      return {
        ...whereClause,
        id: 'impossible-id-that-will-never-match',
      } as T;
    }

    // Add branch filter
    return {
      ...whereClause,
      branchId: {
        in: branchIds,
      },
    } as T;
  }

  /**
   * Ensure user has access to a specific branch
   * Throws ForbiddenException if user doesn't have access
   * 
   * @param userId - User ID
   * @param branchId - Branch ID to check
   * @throws ForbiddenException if user doesn't have access
   */
  async ensureBranchAccess(userId: string, branchId: string): Promise<void> {
    const canAccess = await this.canAccessBranch(userId, branchId);

    if (!canAccess) {
      throw new ForbiddenException(
        `Access denied. You do not have access to branch: ${branchId}`,
      );
    }
  }
}

