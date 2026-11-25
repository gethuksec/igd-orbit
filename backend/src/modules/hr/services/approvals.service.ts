import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';

/**
 * IGDERP-275: unified pending-approvals inbox for dashboard + HP app.
 * Returns request lists grouped by type with the statuses awaiting the
 * caller's decision, plus per-item `canDecide` + the endpoint to call.
 *
 * Step model: leave / overtime / shift-swap flow
 *   pending → (HS/SPV) → manager_approved → (CHR) → approved.
 * Libur stays single-step: pending → approved by libur WRITE_ROLES.
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

@Injectable()
export class ApprovalsService {
  constructor(private prisma: PrismaService) {}

  async pendingApprovals(userId: string, roles: string[], branchIds?: string[] | null) {
    const db: any = this.prisma;
    const isManager = ['HS', 'SPV'].some((r) => roles.includes(r));
    const isHr = roles.includes('CHR');
    const isAdmin = ['SUPERADMIN', 'OWNER'].some((r) => roles.includes(r));
    const canDecideLibur = roles.some((r) => LIBUR_WRITE_ROLES.includes(r));

    // Managers are scoped to their branches; HR/admin see everything.
    const branchScope =
      !isAdmin && !isHr && branchIds && branchIds.length > 0 ? { branchId: { in: branchIds } } : {};

    const requesterOf = (e: any) => ({
      employeeId: e?.id ?? '',
      name: e?.user?.fullName ?? null,
      nik: e?.nik ?? null,
      employeeCode: e?.employeeCode ?? '',
    });

    const items: PendingItem[] = [];

    // ── Leave ──
    const leaveStatuses =
      isAdmin || isHr ? ['pending', 'manager_approved'] : isManager ? ['pending'] : [];
    if (leaveStatuses.length) {
      const rows = await db.leaveRequest.findMany({
        where: { status: { in: leaveStatuses }, employee: branchScope },
        include: { employee: { include: { user: true } }, leaveType: true },
        orderBy: { createdAt: 'asc' },
      });
      for (const r of rows) {
        const step1 = r.status === 'pending';
        const canDecide =
          (step1 && (isAdmin || isManager) || !step1 && (isAdmin || isHr)) && r.requestedBy !== userId;
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
      isAdmin || isHr ? ['pending', 'manager_approved'] : isManager ? ['pending'] : [];
    if (otStatuses.length) {
      const rows = await db.overtimeRequest.findMany({
        where: { status: { in: otStatuses }, employee: branchScope },
        include: { employee: { include: { user: true } } },
        orderBy: { createdAt: 'asc' },
      });
      for (const r of rows) {
        const step1 = r.status === 'pending';
        const canDecide =
          (step1 && (isAdmin || isManager) || !step1 && (isAdmin || isHr)) && r.requestedBy !== userId;
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
      isAdmin || isHr ? ['pending', 'manager_approved'] : isManager ? ['pending'] : [];
    if (swapStatuses.length) {
      const rows = await db.shiftSwapRequest.findMany({
        where: { status: { in: swapStatuses }, employee: branchScope },
        include: {
          employee: { include: { user: true } },
          targetEmployee: { include: { user: true } },
          fromShift: true,
          toShift: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      for (const r of rows) {
        const step1 = r.status === 'pending';
        const canDecide =
          (step1 && (isAdmin || isManager) || !step1 && (isAdmin || isHr)) && r.requestedBy !== userId;
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

    // ── Libur (single-step) ──
    if (isAdmin || isHr || canDecideLibur) {
      const rows = await db.liburRequest.findMany({
        where: { status: 'pending', employee: branchScope },
        include: { employee: { include: { user: true } } },
        orderBy: { createdAt: 'asc' },
      });
      for (const r of rows) {
        items.push({
          kind: 'libur',
          id: r.id,
          status: r.status,
          createdAt: r.createdAt,
          requester: requesterOf(r.employee),
          summary: `Libur ${new Date(r.date).toISOString().slice(0, 10)}`,
          canDecide: canDecideLibur || isAdmin,
          decideEndpoint: 'POST /api/v1/libur/requests/:id/approve',
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
