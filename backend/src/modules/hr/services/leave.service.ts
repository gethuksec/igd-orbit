import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { LeaveRequestDto } from '../dto/leave-request.dto';
import { ApproveLeaveDto } from '../dto/approve-leave.dto';
import { RejectLeaveDto } from '../dto/reject-leave.dto';
import { CancelLeaveDto } from '../dto/cancel-leave.dto';

@Injectable()
export class LeaveService {
  constructor(private prisma: PrismaService) {}

  /**
   * Calculate working days between two dates
   */
  private calculateWorkingDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      // Exclude weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  /**
   * Legacy leave_type strings mapped to seeded master codes (IGDERP-261).
   * Transitional: FE now sends master codes, old clients still send these.
   */
  private legacyTypeMap: Record<string, string> = {
    annual: 'CUTI-TAHUNAN',
    sick: 'SAKIT',
    emergency: 'DARURAT',
    unpaid: 'TANPA-GAJI',
  };

  /**
   * Resolve a leave type code (master code or legacy string) to its master row.
   */
  async resolveLeaveType(code: string) {
    const masterCode = this.legacyTypeMap[code] ?? code;
    const leaveType = await this.prisma.leaveType.findFirst({
      where: { code: masterCode, deletedAt: null },
    });
    if (!leaveType) {
      throw new NotFoundException(`Leave type '${code}' not found`);
    }
    if (!leaveType.isActive) {
      throw new BadRequestException(`Leave type '${leaveType.name}' is inactive`);
    }
    return leaveType;
  }

  /**
   * Get leave balance for employee — quotas read from leave_types master.
   * Returns legacy keys (annual/sick/emergency) for existing FE plus a
   * dynamic `types` array for the new master-driven UI.
   */
  async getLeaveBalance(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    // Get approved leave requests for current year
    const approvedLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'approved',
        startDate: {
          gte: yearStart,
          lte: yearEnd,
        },
      },
      include: { leaveType: true },
    });

    const masters = await this.prisma.leaveType.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { code: 'asc' },
    });

    const types = masters.map((t) => {
      const used = approvedLeaves
        .filter((l) => l.leaveTypeId === t.id)
        .reduce((sum, l) => sum + l.totalDays, 0);
      return {
        code: t.code,
        name: t.name,
        isPaid: t.isPaid,
        quota: t.isPaid ? t.quotaDays : 0,
        used,
        remaining: t.isPaid ? t.quotaDays - used : 0,
        minTenureMonths: t.minTenureMonths ?? null,
      };
    });

    const byCode = (code: string) =>
      types.find((t) => t.code === code) ?? { quota: 0, used: 0, remaining: 0 };

    const annual = byCode('CUTI-TAHUNAN');
    const sick = byCode('SAKIT');
    const emergency = byCode('DARURAT');
    const unpaidUsed = approvedLeaves
      .filter((l) => l.leaveType?.code === 'TANPA-GAJI')
      .reduce((sum, l) => sum + l.totalDays, 0);

    return {
      employeeId,
      year: currentYear,
      annual: {
        quota: annual.quota,
        used: annual.used,
        remaining: annual.remaining,
      },
      sick: {
        quota: sick.quota,
        used: sick.used,
        remaining: sick.remaining,
      },
      emergency: {
        quota: emergency.quota,
        used: emergency.used,
        remaining: emergency.remaining,
      },
      unpaid: {
        used: unpaidUsed,
      },
      types,
    };
  }

  /**
   * Request leave
   */
  async requestLeave(dto: LeaveRequestDto, userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Calculate total days (working days)
    const totalDays = this.calculateWorkingDays(startDate, endDate);
    if (totalDays < 1) {
      throw new BadRequestException('Total working days must be at least 1');
    }

    // Resolve leave type against leave_types master (IGDERP-261)
    const leaveType = await this.resolveLeaveType(dto.leave_type);

    // Minimum working time (masa kerja minimum, e.g. cuti tahunan after 12 months)
    if (leaveType.minTenureMonths !== null && leaveType.minTenureMonths !== undefined && employee.hireDate) {
      const monthsWorked =
        (startDate.getFullYear() - employee.hireDate.getFullYear()) * 12 +
        (startDate.getMonth() - employee.hireDate.getMonth());
      if (monthsWorked < leaveType.minTenureMonths) {
        throw new BadRequestException(
          `Leave type '${leaveType.name}' requires at least ${leaveType.minTenureMonths} months of employment`,
        );
      }
    }

    // Advance-notice rule: standard 3 days, unless the master allows
    // same-day filing (maxApplyDelayDays = 0, e.g. SAKIT max pengajuan hari H)
    if (leaveType.maxApplyDelayDays === null || leaveType.maxApplyDelayDays === undefined) {
      const daysUntilStart = Math.floor((startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilStart < 3) {
        throw new BadRequestException('Leave request must be submitted at least 3 days in advance');
      }
    } else {
      const filingDelayDays = Math.floor((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (filingDelayDays > leaveType.maxApplyDelayDays) {
        throw new BadRequestException(
          `Leave type '${leaveType.name}' must be filed within ${leaveType.maxApplyDelayDays} day(s) of start date`,
        );
      }
    }

    // Monthly frequency cap (e.g. SAKIT sebulan 1x)
    if (leaveType.maxRequestsPerMonth !== null && leaveType.maxRequestsPerMonth !== undefined) {
      const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);
      const thisMonth = await this.prisma.leaveRequest.count({
        where: {
          employeeId: employee.id,
          leaveTypeId: leaveType.id,
          status: { in: ['pending', 'approved'] },
          startDate: { gte: monthStart, lte: monthEnd },
        },
      });
      if (thisMonth >= leaveType.maxRequestsPerMonth) {
        throw new BadRequestException(
          `Leave type '${leaveType.name}' is limited to ${leaveType.maxRequestsPerMonth}x per month`,
        );
      }
    }

    // Check leave balance (paid types only; unpaid skips quota)
    if (leaveType.isPaid) {
      const balance = await this.getLeaveBalance(employee.id);
      const entry = balance.types.find((t) => t.code === leaveType.code);
      if (entry && entry.remaining < totalDays) {
        throw new BadRequestException(`Insufficient ${leaveType.name} balance`);
      }
    }

    // Check for conflicting leave
    const conflictingLeave = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: { in: ['pending', 'approved'] },
        OR: [
          {
            startDate: { lte: endDate },
            endDate: { gte: startDate },
          },
        ],
      },
    });

    if (conflictingLeave) {
      throw new BadRequestException('Conflicting leave request found');
    }

    // Require attachment when the master says so (e.g. sick/emergency)
    if (leaveType.requiresAttachment && !dto.attachment_url) {
      throw new BadRequestException(`Attachment is required for ${leaveType.name} leave`);
    }

    // Create leave request
    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate: startDate,
        endDate: endDate,
        totalDays: totalDays,
        reason: dto.reason,
        attachmentUrl: dto.attachment_url,
        requestedBy: userId,
        status: 'pending',
      },
      include: {
        employee: {
          include: { user: true },
        },
        leaveType: true,
      },
    });

    return leaveRequest;
  }

  /**
   * Approve leave
   */
  async approveLeave(leaveId: string, _dto: ApproveLeaveDto, userId: string, userRoles: string[]) {
    // Check permission
    const hasPermission = ['HS', 'SPV', 'CHR'].some((role) => userRoles.includes(role));
    if (!hasPermission) {
      throw new ForbiddenException('Only HS, SPV, or CHR can approve leave');
    }

    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: { employee: true },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.status !== 'pending') {
      throw new BadRequestException('Leave request is not pending');
    }

    // Update leave request
    const approved = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
      },
      include: {
        employee: {
          include: { user: true },
        },
      },
    });

    // Create attendance placeholders for leave days
    const current = new Date(leaveRequest.startDate);
    while (current <= leaveRequest.endDate) {
      const dayOfWeek = current.getDay();
      // Only create for weekdays
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        await this.prisma.attendance.upsert({
          where: {
            employeeId_date: {
              employeeId: leaveRequest.employeeId,
              date: new Date(current),
            },
          },
          update: {
            status: 'leave',
          },
          create: {
            employeeId: leaveRequest.employeeId,
            date: new Date(current),
            branchId: leaveRequest.employee.branchId || '',
            status: 'leave',
          },
        });
      }
      current.setDate(current.getDate() + 1);
    }

    return approved;
  }

  /**
   * Reject leave
   */
  async rejectLeave(leaveId: string, dto: RejectLeaveDto, userId: string, userRoles: string[]) {
    // Check permission
    const hasPermission = ['HS', 'SPV', 'CHR'].some((role) => userRoles.includes(role));
    if (!hasPermission) {
      throw new ForbiddenException('Only HS, SPV, or CHR can reject leave');
    }

    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    if (leaveRequest.status !== 'pending') {
      throw new BadRequestException('Leave request is not pending');
    }

    const rejected = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: 'rejected',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: dto.reason,
      },
      include: {
        employee: {
          include: { user: true },
        },
      },
    });

    return rejected;
  }

  /**
   * Cancel leave
   */
  async cancelLeave(leaveId: string, dto: CancelLeaveDto, userId: string) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: { employee: true },
    });

    if (!leaveRequest) {
      throw new NotFoundException('Leave request not found');
    }

    // Check if user owns this leave request
    if (leaveRequest.requestedBy !== userId) {
      throw new ForbiddenException('You can only cancel your own leave requests');
    }

    if (leaveRequest.status !== 'approved') {
      throw new BadRequestException('Only approved leave can be cancelled');
    }

    // Check if leave has started
    if (new Date() >= leaveRequest.startDate) {
      throw new BadRequestException('Cannot cancel leave that has already started');
    }

    // Update leave request
    const cancelled = await this.prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: new Date(),
        cancellationReason: dto.reason,
      },
      include: {
        employee: {
          include: { user: true },
        },
      },
    });

    // Remove attendance placeholders
    const current = new Date(leaveRequest.startDate);
    while (current <= leaveRequest.endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        await this.prisma.attendance.deleteMany({
          where: {
            employeeId: leaveRequest.employeeId,
            date: new Date(current),
            status: 'leave',
          },
        });
      }
      current.setDate(current.getDate() + 1);
    }

    return cancelled;
  }

  /**
   * List leave requests
   */
  async findAll(employeeId?: string, status?: string, startDate?: Date, endDate?: Date) {
    const where: any = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.OR = [];
      if (startDate && endDate) {
        where.OR.push({
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        });
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            include: { user: true },
          },
          leaveType: true,
        },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return {
      data,
      total,
    };
  }
}

