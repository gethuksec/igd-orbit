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
   * Get leave balance for employee
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
    });

    // Calculate used leave
    const annualUsed = approvedLeaves
      .filter((l) => l.leaveType === 'annual')
      .reduce((sum, l) => sum + l.totalDays, 0);

    const sickUsed = approvedLeaves
      .filter((l) => l.leaveType === 'sick')
      .reduce((sum, l) => sum + l.totalDays, 0);

    const emergencyUsed = approvedLeaves
      .filter((l) => l.leaveType === 'emergency')
      .reduce((sum, l) => sum + l.totalDays, 0);

    // Default quotas
    const annualQuota = 12;
    const sickQuota = 12;
    const emergencyQuota = 3; // Example

    return {
      employeeId,
      year: currentYear,
      annual: {
        quota: annualQuota,
        used: annualUsed,
        remaining: annualQuota - annualUsed,
      },
      sick: {
        quota: sickQuota,
        used: sickUsed,
        remaining: sickQuota - sickUsed,
      },
      emergency: {
        quota: emergencyQuota,
        used: emergencyUsed,
        remaining: emergencyQuota - emergencyUsed,
      },
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
    if (totalDays !== dto.total_days) {
      throw new BadRequestException(`Total days mismatch. Calculated: ${totalDays}, provided: ${dto.total_days}`);
    }

    // Check minimum advance notice (3 days, except emergency)
    if (dto.leave_type !== 'emergency') {
      const daysUntilStart = Math.floor((startDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilStart < 3) {
        throw new BadRequestException('Leave request must be submitted at least 3 days in advance');
      }
    }

    // Check leave balance
    const balance = await this.getLeaveBalance(employee.id);
    if (dto.leave_type === 'annual' && balance.annual.remaining < totalDays) {
      throw new BadRequestException('Insufficient annual leave balance');
    }
    if (dto.leave_type === 'sick' && balance.sick.remaining < totalDays) {
      throw new BadRequestException('Insufficient sick leave balance');
    }
    if (dto.leave_type === 'emergency' && balance.emergency.remaining < totalDays) {
      throw new BadRequestException('Insufficient emergency leave balance');
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

    // Require attachment for sick/emergency
    if ((dto.leave_type === 'sick' || dto.leave_type === 'emergency') && !dto.attachment_url) {
      throw new BadRequestException('Attachment is required for sick/emergency leave');
    }

    // Create leave request
    const leaveRequest = await this.prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveType: dto.leave_type,
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

    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          include: { user: true },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }
}

