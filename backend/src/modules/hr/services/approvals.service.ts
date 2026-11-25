import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';

/**
 * IGDERP-275: unified pending-approvals inbox for dashboard + HP app.
 * Returns request lists grouped by type with the statuses awaiting the
 * caller's decision, plus per-item `canDecide` + the endpoint to call.
 *
 * Step model: leave / overtime / shift-swap flow
 *   pending → (direct atasan N+1) → manager_approved → (CHR) → approved.
 * Libur: pending → (atasan N+1) → atasan-approved → (HR-final) → approved.
 * canDecide on step 1 = caller holds the requester's parent title in the
 * same branch scope (SUPERADMIN/OWNER bypass); CHR/admin keep step-2.
 */
export interface PendingItem {
  kind: 'leave' | 'overtime' | 'shift_swap' | 'libur';
  id: string;
  status: string;
  createdAt: Date;
  requester: { employeeId: string; name: string | null; nik: string | null; employeeCode: string };
  summary: string;
  canDecide: boolean;
  decideEndpoint: string;
  // IGDERP-313: leave period for inbox cards (approver needs dates
  // without opening detail). Only populated for kind === 'leave'.
  startDate?: Date;
  endDate?: Date;
}

const LIBUR_WRITE_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'CHR'];

// Titles that can sit on the approval line (L2-L5 + legacy codes).
// Visibility only — canDecide is resolved per row against the N+1 holder.
const LINE_ROLES = [
  'MU', 'MM', 'MO', 'MS',
  'SPV-MKT', 'HS', 'SPV-SC', 'SPV-FO', 'SPV-HRD',
  'AS-SE', 'AS-SRV', 'MGR', 'SPV',
];

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async pendingApprovals(userId: string, roles: string[], branchIds?: string[] | null) {
    const db: any = this.prisma;
    const isLine = LINE_ROLES.some((r) => roles.includes(r));
    const isHr = roles.includes('CHR');
    const isAdmin = ['SUPERADMIN', 'OWNER'].some((r) => roles.includes(r));
    const canDecideLiburHr = roles.some((r) => LIBUR_WRITE_ROLES.includes(r));

    // Caller identity for the N+1 holder check (per-row below).
    const callerEmp = await db.employee.findUnique({
      where: { userId },
      select: { id: true, positionId: true, branchId: true },
    });
    const callerBranchRows: Array<{ branchId: string }> =
      (await db.userBranch.findMany({ where: { userId }, select: { branchId: true } })) ?? [];
    const callerBranches = callerBranchRows.map((r) => r.branchId);
    const n1Can = (reqEmp: any, requestedBy: string) => {
      if (requestedBy === userId) return false;
      if (isAdmin) return true; // emergency bypass
      if (!callerEmp) return false;
      const parentId = reqEmp?.position?.parentPositionId ?? null;
      if (!parentId) return false; // top of chain: admins only
      if (callerEmp.positionId !== parentId) return false;
      const rb = reqEmp?.branchId ?? null;
      const cb = callerEmp.branchId ?? null;
      return rb === null || cb === null || cb === rb || callerBranches.includes(rb);
    };

    // Managers are scoped to their branches; HR/admin see everything.
    const branchScope =
      !isAdmin && !isHr && branchIds && branchIds.length > 0 ? { branchId: { in: branchIds } } : {};

    const requesterOf = (e: any) => ({
      employeeId: e?.id ?? '',
      name: e?.user?.fullName ?? null,
      nik: e?.nik ?? null,
      employeeCode: e?.employeeCode ?? '',
    });

    const withPosition = { user: true, position: { select: { id: true, parentPositionId: true } } };

    const items: PendingItem[] = [];

    // ── Leave ──
    const leaveStatuses =
      isAdmin || isHr ? ['pending', 'manager_approved'] : isLine ? ['pending'] : [];
    if (leaveStatuses.length) {
      const rows = await db.leaveRequest.findMany({
        where: { status: { in: leaveStatuses }, employee: branchScope },
        include: { employee: { include: withPosition }, leaveType: true },
        orderBy: { createdAt: 'asc' },
      });
      for (const r of rows) {
        const step1 = r.status === 'pending';
        const canDecide = step1 ? n1Can(r.employee, r.requestedBy) : (isAdmin || isHr) && r.requestedBy !== userId;
        items.push({
          kind: 'leave',
          id: r.id,
          status: r.status,
          createdAt: r.createdAt,
          requester: requesterOf(r.employee),
          summary: `${r.leaveType?.name ?? 'Cuti'} · ${r.totalDays} hari`,
          canDecide,
          decideEndpoint: step1 ? 'POST /api/v1/leave/approve?id=' : 'POST /api/v1/leave/approve-hr?id=',
          startDate: r.startDate,
          endDate: r.endDate,
        });
      }
    }

    // ── Overtime ──
    const otStatuses =
      isAdmin || isHr ? ['pending', 'manager_approved'] : isLine ? ['pending'] : [];
    if (otStatuses.length) {
      const rows = await db.overtimeRequest.findMany({
        where: { status: { in: otStatuses }, employee: branchScope },
        include: { employee: { include: withPosition } },
        orderBy: { createdAt: 'asc' },
      });
      for (const r of rows) {
        const step1 = r.status === 'pending';
        const canDecide = step1 ? n1Can(r.employee, r.requestedBy) : (isAdmin || isHr) && r.requestedBy !== userId;
        items.push({
          kind: 'overtime',
          id: r.id,
          status: r.status,
          createdAt: r.createdAt,
          requester: requesterOf(r.employee),
          summary: `Lembur ${Number(r.hours)} jam`,
          canDecide,
          decideEndpoint: step1
            ? 'POST /api/v1/attendance/overtime/approve?id='
            : 'POST /api/v1/attendance/overtime/approve-hr?id=',
        });
      }
    }

    // ── Shift swap ──
    const swapStatuses =
      isAdmin || isHr ? ['pending', 'manager_approved'] : isLine ? ['pending'] : [];
    if (swapStatuses.length) {
      const rows = await db.shiftSwapRequest.findMany({
        where: { status: { in: swapStatuses }, employee: branchScope },
        include: {
          employee: { include: withPosition },
          targetEmployee: { include: { user: true } },
          fromShift: true,
          toShift: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      for (const r of rows) {
        const step1 = r.status === 'pending';
        const canDecide = step1 ? n1Can(r.employee, r.requestedBy) : (isAdmin || isHr) && r.requestedBy !== userId;
        items.push({
          kind: 'shift_swap',
          id: r.id,
          status: r.status,
          createdAt: r.createdAt,
          requester: requesterOf(r.employee),
          summary: `Tukar ${r.fromShift?.name ?? '?'} → ${r.toShift?.name ?? '?'} (${r.targetEmployee?.user?.fullName ?? '?'})`,
          canDecide,
          decideEndpoint: step1
            ? 'POST /api/v1/shift-swap/approve?id='
            : 'POST /api/v1/shift-swap/approve-hr?id=',
        });
      }
    }

    // ── Libur: atasan step (N+1) then HR-final ──
    if (isAdmin || isHr || canDecideLiburHr || isLine) {
      const rows = await db.liburRequest.findMany({
        where: { status: 'pending', employee: branchScope },
        include: { employee: { include: withPosition } },
        orderBy: { createdAt: 'asc' },
      });
      for (const r of rows) {
        const atasanDone = (r as any).atasanStatus === 'approved';
        const canDecide = atasanDone
          ? (isAdmin || isHr || canDecideLiburHr) && r.requestedBy !== userId
          : n1Can(r.employee, r.requestedBy);
        items.push({
          kind: 'libur',
          id: r.id,
          status: r.status,
          createdAt: r.createdAt,
          requester: requesterOf(r.employee),
          summary: `Libur ${new Date(r.date).toISOString().slice(0, 10)}`,
          canDecide,
          decideEndpoint: atasanDone
            ? 'POST /api/v1/libur/requests/:id/approve'
            : 'POST /api/v1/libur/requests/:id/atasan-approve',
        });
      }
    }

    items.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    return {
      data: items,
      total: items.length,
      awaitingDecision: items.filter((i) => i.canDecide).length,
    };
  }
}
