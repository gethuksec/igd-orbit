import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

/**
 * N+1 vertical approval resolver (thread 20261125-hierarchy).
 *
 * A step-1 (atasan) decision is valid only when the caller holds the
 * requester's direct parent title (Position.parentPositionId) in the same
 * branch scope — never a same-level role, never a higher rank in another
 * line. Department/division are NOT consulted: the chain implies the line
 * (e.g. HS carries no division yet approves SE in DIV-OPS-SE by design).
 *
 * Exceptions:
 * - Top of chain (MU, parent null): only SUPERADMIN/OWNER can step in.
 * - SUPERADMIN/OWNER bypass N+1 anywhere (emergency, logged via the
 *   decidedBy/managerApprovedBy audit columns as before).
 * - Vacant N+1 (no holder in branch): nobody can decide — the request stays
 *   pending until HR fixes the master data (no grandparent escalation).
 */
const BYPASS_ROLES = ['SUPERADMIN', 'OWNER'];

export interface N1Decision {
  requesterEmployeeId: string;
  parentPositionId: string | null;
  bypass: boolean;
}

function isBypass(roles: string[] = []): boolean {
  return roles.some((r) => BYPASS_ROLES.includes(r));
}

export async function assertN1Approver(
  prisma: any,
  requesterEmployeeId: string,
  callerUserId: string,
  callerRoles: string[] = [],
): Promise<N1Decision> {
  const requester = await prisma.employee.findUnique({
    where: { id: requesterEmployeeId },
    select: {
      id: true,
      branchId: true,
      positionId: true,
      position: { select: { id: true, parentPositionId: true } },
    },
  });
  if (!requester) {
    throw new NotFoundException('Requester employee not found');
  }

  const positionId: string | null = requester.positionId ?? requester.position?.id ?? null;
  if (!positionId) {
    throw new BadRequestException(
      'Requester has no job title — HR must assign a position before approval',
    );
  }
  const parentId: string | null = requester.position?.parentPositionId ?? null;
  if (!parentId) {
    // Top of chain (MU): only system owners can step in.
    if (!isBypass(callerRoles)) {
      throw new ForbiddenException(
        'Requester sits at the top of the chain — only OWNER/SUPERADMIN can decide',
      );
    }
    return { requesterEmployeeId, parentPositionId: null, bypass: true };
  }
  if (isBypass(callerRoles)) {
    return { requesterEmployeeId, parentPositionId: parentId, bypass: true };
  }

  const caller = await prisma.employee.findUnique({
    where: { userId: callerUserId },
    select: { id: true, positionId: true, branchId: true, isActive: true },
  });
  if (!caller || !caller.isActive) {
    throw new ForbiddenException('Hanya atasan langsung (N+1) yang dapat memutuskan');
  }
  if (caller.id === requester.id) {
    throw new ForbiddenException('Requester cannot approve their own request');
  }
  if (caller.positionId !== parentId) {
    throw new ForbiddenException('Hanya atasan langsung (N+1) yang dapat memutuskan');
  }

  // Same-branch scope. Null branch on either side means company-wide
  // (HO titles), which matches any branch; otherwise the caller must hold
  // the requester's branch as primary or via UserBranch assignment.
  const reqBranch: string | null = requester.branchId ?? null;
  const callerBranch: string | null = caller.branchId ?? null;
  let branchOk = reqBranch === null || callerBranch === null || callerBranch === reqBranch;
  if (!branchOk) {
    const rows: Array<{ branchId: string }> =
      (await prisma.userBranch.findMany({
        where: { userId: callerUserId },
        select: { branchId: true },
      })) ?? [];
    branchOk = rows.some((r) => r.branchId === reqBranch);
  }
  if (!branchOk) {
    throw new ForbiddenException('Atasan langsung berbeda cabang — tidak dapat memutuskan');
  }

  return { requesterEmployeeId, parentPositionId: parentId, bypass: false };
}
