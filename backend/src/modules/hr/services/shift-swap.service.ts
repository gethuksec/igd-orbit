import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { ShiftSwapRequestDto } from '../dto/shift-swap-request.dto';
import { RejectShiftSwapDto } from '../dto/reject-shift-swap.dto';
import { assertN1Approver } from './n1-approver';

/**
 * IGDERP-275: shift swap (tukar shift) with 2-step approval.
 * pending (requester files) → manager_approved (direct atasan N+1) → approved (CHR).
 * On final approval the two employees' shift assignments covering `date`
 * are swapped.
 */
@Injectable()
export class ShiftSwapService {
  constructor(private prisma: PrismaService) {}

  async requestSwap(dto: ShiftSwapRequestDto, userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');

    if (dto.target_employee_id === employee.id) {
      throw new BadRequestException('Cannot swap shift with yourself');
    }
    if (dto.from_shift_id === dto.to_shift_id) {
      throw new BadRequestException('Source and target shift must differ');
    }

    const target = await this.prisma.employee.findUnique({ where: { id: dto.target_employee_id } });
    if (!target || !target.isActive) {
      throw new NotFoundException('Target employee not found or inactive');
    }

    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);
    if (date < new Date(new Date().setHours(0, 0, 0, 0))) {
      throw new BadRequestException('Swap date must be today or in the future');
    }

    const [fromShift, toShift] = await Promise.all([
      this.prisma.shift.findUnique({ where: { id: dto.from_shift_id } }),
      this.prisma.shift.findUnique({ where: { id: dto.to_shift_id } }),
    ]);
    if (!fromShift || fromShift.deletedAt || !fromShift.isActive) {
      throw new NotFoundException('Source shift not found or inactive');
    }
    if (!toShift || toShift.deletedAt || !toShift.isActive) {
      throw new NotFoundException('Target shift not found or inactive');
    }

    // No duplicate pending swap for the same requester+date
    const existing = await this.prisma.shiftSwapRequest.findFirst({
      where: {
        employeeId: employee.id,
        date,
        status: { in: ['pending', 'manager_approved'] },
      },
    });
    if (existing) {
      throw new BadRequestException('A pending swap request already exists for this date');
    }

    return this.prisma.shiftSwapRequest.create({
      data: {
        employeeId: employee.id,
        targetEmployeeId: dto.target_employee_id,
        date,
        fromShiftId: dto.from_shift_id,
        toShiftId: dto.to_shift_id,
        reason: dto.reason,
        requestedBy: userId,
        status: 'pending',
      },
      include: {
        employee: { include: { user: true } },
        targetEmployee: { include: { user: true } },
        fromShift: true,
        toShift: true,
      },
    });
  }

  async findAll(employeeId?: string, status?: string) {
    const where: any = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      this.prisma.shiftSwapRequest.findMany({
        where,
        include: {
          employee: { include: { user: true } },
          targetEmployee: { include: { user: true } },
          fromShift: true,
          toShift: true,
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.shiftSwapRequest.count({ where }),
    ]);
    return { data, total };
  }

  async approve(swapId: string, userId: string, userRoles: string[]) {
    const swap = await this.prisma.shiftSwapRequest.findUnique({ where: { id: swapId } });
    if (!swap) throw new NotFoundException('Shift swap request not found');
    if (swap.status !== 'pending') throw new BadRequestException('Shift swap request is not pending');
    if (swap.requestedBy === userId) throw new ForbiddenException('Requester cannot approve their own swap');

    // N+1: only the requester's direct parent title in the same branch
    // (or SUPERADMIN/OWNER bypass) may take step 1.
    await assertN1Approver(this.prisma, swap.employeeId, userId, userRoles);

    return this.prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'manager_approved',
        managerApprovedBy: userId,
        managerApprovedAt: new Date(),
      },
    });
  }

  async approveHr(swapId: string, userId: string, userRoles: string[]) {
    const isHr = ['CHR'].some((r) => userRoles.includes(r));
    if (!isHr) throw new ForbiddenException('Only CHR can finalize shift swap approval (step 2)');

    const swap = await this.prisma.shiftSwapRequest.findUnique({ where: { id: swapId } });
    if (!swap) throw new NotFoundException('Shift swap request not found');
    if (swap.status !== 'manager_approved') {
      throw new BadRequestException('Shift swap request needs manager approval first');
    }

    const approved = await this.prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'approved',
        hrApprovedBy: userId,
        hrApprovedAt: new Date(),
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    // Swap the two employees' assignments covering the date.
    // Assignment rows span ranges: requester takes target shift, target takes requester shift.
    await this.swapAssignmentsForDate(swap);

    return approved;
  }

  /**
   * Exchange shift assignments covering swap.date between requester and target.
   * Best-effort: rows fully inside other ranges are split by ending them
   * the day before and creating new rows from swap.date.
   */
  private async swapAssignmentsForDate(swap: {
    employeeId: string;
    targetEmployeeId: string;
    date: Date;
    fromShiftId: string;
    toShiftId: string;
  }) {
    const day = new Date(swap.date);
    day.setHours(0, 0, 0, 0);
    const prevDay = new Date(day);
    prevDay.setDate(prevDay.getDate() - 1);

    const covering = await this.prisma.shiftAssignment.findMany({
      where: {
        employeeId: { in: [swap.employeeId, swap.targetEmployeeId] },
        startDate: { lte: day },
        OR: [{ endDate: null }, { endDate: { gte: day } }],
      },
    });

    const mine = covering.find(
      (a) => a.employeeId === swap.employeeId && a.shiftId === swap.fromShiftId,
    );
    const theirs = covering.find(
      (a) => a.employeeId === swap.targetEmployeeId && a.shiftId === swap.toShiftId,
    );
    // Only swap when both sides hold the expected shifts on that date —
    // otherwise the approval still records, assignments stay untouched.
    if (!mine || !theirs) return;

    await this.prisma.$transaction(async (tx: any) => {
      // End current rows the day before the swap date (when they extend past it)
      for (const row of [mine, theirs]) {
        const endsAfter = !row.endDate || new Date(row.endDate) > day;
        if (endsAfter) {
          await tx.shiftAssignment.update({
            where: { id: row.id },
            data: { endDate: prevDay },
          });
        }
      }
      // New rows from swap date carrying the other side's remaining span
      const newRows = [
        { employeeId: swap.employeeId, shiftId: swap.toShiftId, src: theirs },
        { employeeId: swap.targetEmployeeId, shiftId: swap.fromShiftId, src: mine },
      ];
      for (const r of newRows) {
        await tx.shiftAssignment.create({
          data: {
            employeeId: r.employeeId,
            shiftId: r.shiftId,
            startDate: day,
            endDate: (r.src as any).endDate ?? undefined,
            weekdays: (r.src as any).weekdays,
            offDates: (r.src as any).offDates ?? [],
            note: `IGDERP-275 shift swap ${swap.employeeId}<>` + swap.targetEmployeeId,
          },
        });
      }
    });
  }

  async reject(swapId: string, dto: RejectShiftSwapDto, userId: string, userRoles: string[]) {
    const isHr = ['CHR'].some((r) => userRoles.includes(r));

    const swap = await this.prisma.shiftSwapRequest.findUnique({ where: { id: swapId } });
    if (!swap) throw new NotFoundException('Shift swap request not found');
    if (swap.status === 'pending') {
      // N+1: only the direct atasan (or bypass) may reject at step 1.
      await assertN1Approver(this.prisma, swap.employeeId, userId, userRoles);
    } else if (swap.status === 'manager_approved') {
      if (!isHr) throw new ForbiddenException('Only CHR can reject after manager approval');
    } else {
      throw new BadRequestException('Shift swap request is not awaiting your decision');
    }

    return this.prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: {
        status: 'rejected',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: dto.reason,
      },
    });
  }

  async cancel(swapId: string, userId: string) {
    const swap = await this.prisma.shiftSwapRequest.findUnique({ where: { id: swapId } });
    if (!swap) throw new NotFoundException('Shift swap request not found');
    if (swap.requestedBy !== userId) {
      throw new ForbiddenException('You can only cancel your own shift swap requests');
    }
    if (!['pending', 'manager_approved'].includes(swap.status)) {
      throw new BadRequestException('Only undecided shift swaps can be cancelled');
    }
    return this.prisma.shiftSwapRequest.update({
      where: { id: swapId },
      data: { status: 'cancelled', cancelledBy: userId, cancelledAt: new Date() },
    });
  }
}
