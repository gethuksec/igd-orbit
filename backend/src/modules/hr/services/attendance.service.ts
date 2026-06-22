import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { ClockInDto } from '../dto/clock-in.dto';
import { ClockOutDto } from '../dto/clock-out.dto';
import { ManualAdjustmentDto } from '../dto/manual-adjustment.dto';
import { OvertimeRequestDto } from '../dto/overtime-request.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Clock in
   */
  async clockIn(userId: string, dto: ClockInDto) {
    // Get employee
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { branch: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!employee.isActive) {
      throw new BadRequestException('Employee is not active');
    }

    // Validate branch assignment
    if (employee.branchId !== dto.branch_id) {
      throw new BadRequestException('Employee is not assigned to this branch');
    }

    // Check if already clocked in today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingAttendance = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: today,
        },
      },
    });

    if (existingAttendance && existingAttendance.clockIn) {
      throw new BadRequestException('Already clocked in today');
    }

    // Get branch operating hours
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branch_id },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Calculate if late
    const now = new Date();
    let isLate = false;
    let lateMinutes = 0;

    if (branch.operatingHours) {
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
      const operatingHours = branch.operatingHours as any;
      const dayHours = operatingHours[dayName];

      if (dayHours && dayHours.open) {
        const [openHour, openMinute] = dayHours.open.split(':').map(Number);
        const expectedStart = new Date(now);
        expectedStart.setHours(openHour, openMinute, 0, 0);

        if (now > expectedStart) {
          const diffMs = now.getTime() - expectedStart.getTime();
          lateMinutes = Math.floor(diffMs / (1000 * 60));
          // 15 minutes grace period
          if (lateMinutes > 15) {
            isLate = true;
          } else {
            lateMinutes = 0;
          }
        }
      }
    }

    // Create or update attendance record
    const attendance = await this.prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: today,
        },
      },
      update: {
        clockIn: now,
        clockInMethod: dto.method,
        clockInLocation: dto.clock_in_location,
        internalNotes: dto.notes,
        isLate,
        lateMinutes,
        status: 'present',
        updatedAt: new Date(),
      },
      create: {
        employeeId: employee.id,
        date: today,
        branchId: dto.branch_id,
        clockIn: now,
        clockInMethod: dto.method,
        clockInLocation: dto.clock_in_location,
        internalNotes: dto.notes,
        status: 'present',
        isLate,
        lateMinutes,
      },
      include: {
        employee: {
          include: { user: true },
        },
        branch: true,
      },
    });

    return attendance;
  }

  /**
   * Clock out
   */
  async clockOut(userId: string, dto: ClockOutDto) {
    // Get employee
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { branch: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // Find today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendance = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: today,
        },
      },
      include: { branch: true },
    });

    if (!attendance) {
      throw new NotFoundException('No attendance record found for today. Please clock in first.');
    }

    if (attendance.clockOut) {
      throw new BadRequestException('Already clocked out today');
    }

    if (!attendance.clockIn) {
      throw new BadRequestException('Cannot clock out without clocking in first');
    }

    // Calculate work hours
    const now = new Date();
    const clockInTime = attendance.clockIn;
    const diffMs = now.getTime() - clockInTime.getTime();
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const breakTimeHours = attendance.breakTime || new Decimal(1);
    const workHours = new Decimal(totalMinutes / 60).minus(breakTimeHours);

    // Calculate early leave
    let isEarlyLeave = false;
    let earlyLeaveMinutes = 0;

    if (attendance.branch.operatingHours) {
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
      const operatingHours = attendance.branch.operatingHours as any;
      const dayHours = operatingHours[dayName];

      if (dayHours && dayHours.close) {
        const [closeHour, closeMinute] = dayHours.close.split(':').map(Number);
        const expectedEnd = new Date(now);
        expectedEnd.setHours(closeHour, closeMinute, 0, 0);

        if (now < expectedEnd) {
          const diffMs = expectedEnd.getTime() - now.getTime();
          earlyLeaveMinutes = Math.floor(diffMs / (1000 * 60));
          isEarlyLeave = true;
        }
      }
    }

    // Update attendance
    const updated = await this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOut: now,
        clockOutMethod: dto.method,
        clockOutLocation: dto.clock_out_location,
        internalNotes: dto.notes ? (attendance.internalNotes ? `${attendance.internalNotes}\n[Clock Out] ${dto.notes}` : `[Clock Out] ${dto.notes}`) : attendance.internalNotes,
        isEarlyLeave,
        earlyLeaveMinutes,
        totalHours: workHours.greaterThan(0) ? workHours : new Decimal(0),
        updatedAt: new Date(),
      },
      include: {
        employee: {
          include: { user: true },
        },
        branch: true,
      },
    });

    return updated;
  }

  /**
   * Get monthly summary
   */
  async getMonthlySummary(userId: string, month: number, year: number) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const attendances = await this.prisma.attendance.findMany({
      where: {
        employeeId: employee.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const totalWorkDays = attendances.length;
    const presentDays = attendances.filter((a) => a.status === 'present').length;
    const lateCount = attendances.filter((a) => a.isLate).length;
    const earlyLeaveCount = attendances.filter((a) => a.isEarlyLeave).length;
    const absenceCount = attendances.filter((a) => a.status === 'absent').length;
    const leaveCount = attendances.filter((a) => a.status === 'leave').length;

    const totalLateMinutes = attendances.reduce((sum, a) => sum + a.lateMinutes, 0);
    const totalOvertimeHours = attendances.reduce(
      (sum, a) => sum + (a.overtimeHours?.toNumber() || 0),
      0,
    );

    return {
      employeeId: employee.id,
      month,
      year,
      totalWorkDays,
      presentDays,
      lateCount,
      earlyLeaveCount,
      absenceCount,
      leaveCount,
      totalLateMinutes,
      totalOvertimeHours,
      attendances: attendances.map((a) => ({
        id: a.id,
        date: a.date,
        clockIn: a.clockIn,
        clockOut: a.clockOut,
        status: a.status,
        isLate: a.isLate,
        lateMinutes: a.lateMinutes,
        totalHours: a.totalHours?.toNumber(),
        overtimeHours: a.overtimeHours?.toNumber(),
      })),
    };
  }

  /**
   * Manual adjustment
   */
  async manualAdjustment(dto: ManualAdjustmentDto, userId: string, userRoles: string[]) {
    // Check permission
    const hasPermission = ['HS', 'SPV', 'CHR'].some((role) => userRoles.includes(role));
    if (!hasPermission) {
      throw new ForbiddenException('Only HS, SPV, or CHR can make manual adjustments');
    }

    const attendance = await this.prisma.attendance.findUnique({
      where: { id: dto.attendance_id },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }

    const updateData: any = {
      adjustedBy: userId,
      adjustmentReason: dto.reason,
      updatedAt: new Date(),
    };

    if (dto.clock_in) {
      updateData.clockIn = new Date(dto.clock_in);
    }

    if (dto.clock_out) {
      updateData.clockOut = new Date(dto.clock_out);
    }

    if (dto.is_late !== undefined) {
      updateData.isLate = dto.is_late;
    }

    if (dto.late_minutes !== undefined) {
      updateData.lateMinutes = dto.late_minutes;
    }

    // Recalculate total hours if both clock in and out are provided
    if (updateData.clockIn && updateData.clockOut) {
      const clockIn = updateData.clockIn instanceof Date ? updateData.clockIn : new Date(updateData.clockIn);
      const clockOut = updateData.clockOut instanceof Date ? updateData.clockOut : new Date(updateData.clockOut);
      const diffMs = clockOut.getTime() - clockIn.getTime();
      const totalMinutes = Math.floor(diffMs / (1000 * 60));
      const breakTimeHours = attendance.breakTime || new Decimal(1);
      updateData.totalHours = new Decimal(totalMinutes / 60).minus(breakTimeHours);
    }

    const updated = await this.prisma.attendance.update({
      where: { id: dto.attendance_id },
      data: updateData,
      include: {
        employee: {
          include: { user: true },
        },
        branch: true,
      },
    });

    return updated;
  }

  /**
   * Request overtime
   */
  async requestOvertime(userId: string, dto: OvertimeRequestDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);

    // Check if attendance exists for that date
    const attendance = await this.prisma.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: date,
        },
      },
    });

    if (!attendance) {
      throw new BadRequestException('Attendance record not found for the specified date');
    }

    // Calculate estimated amount
    let estimatedAmount: Decimal | null = null;
    if (employee.hourlyRate) {
      const hoursDecimal = new Decimal(dto.hours);
      // Check if weekend or holiday (simplified - would need holiday calendar)
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const multiplier = isWeekend ? 2.0 : 1.5;
      estimatedAmount = employee.hourlyRate.times(hoursDecimal).times(multiplier);
    }

    const overtimeRequest = await this.prisma.overtimeRequest.create({
      data: {
        employeeId: employee.id,
        attendanceId: attendance.id,
        date: date,
        hours: new Decimal(dto.hours),
        reason: dto.reason,
        estimatedAmount,
        requestedBy: userId,
        status: 'pending',
      },
      include: {
        employee: {
          include: { user: true },
        },
        attendance: true,
      },
    });

    return overtimeRequest;
  }

  /**
   * Approve overtime
   */
  async approveOvertime(overtimeId: string, userId: string, userRoles: string[]) {
    // Check permission
    const hasPermission = ['HS', 'SPV'].some((role) => userRoles.includes(role));
    if (!hasPermission) {
      throw new ForbiddenException('Only HS or SPV can approve overtime');
    }

    const overtimeRequest = await this.prisma.overtimeRequest.findUnique({
      where: { id: overtimeId },
      include: { attendance: true },
    });

    if (!overtimeRequest) {
      throw new NotFoundException('Overtime request not found');
    }

    if (overtimeRequest.status !== 'pending') {
      throw new BadRequestException('Overtime request is not pending');
    }

    // Update overtime request
    const updatedRequest = await this.prisma.overtimeRequest.update({
      where: { id: overtimeId },
      data: {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    // Update attendance record
    if (overtimeRequest.attendance) {
      await this.prisma.attendance.update({
        where: { id: overtimeRequest.attendance.id },
        data: {
          overtimeHours: overtimeRequest.hours,
          overtimeApproved: true,
          overtimeApprovedBy: userId,
        },
      });
    }

    return updatedRequest;
  }

  /**
   * List attendance records
   */
  async findAll(
    userId?: string,
    employeeId?: string,
    startDate?: Date,
    endDate?: Date,
    search?: string,
    status?: string,
    branchId?: string,
  ) {
    const where: any = {};

    if (employeeId) {
      where.employeeId = employeeId;
    } else if (userId) {
      const employee = await this.prisma.employee.findUnique({
        where: { userId },
      });
      if (employee) {
        where.employeeId = employee.id;
      }
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = startDate;
      }
      if (endDate) {
        where.date.lte = endDate;
      }
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (branchId) {
      where.branchId = branchId;
    }

    if (search) {
      where.OR = [
        {
          employee: {
            user: {
              fullName: { contains: search, mode: 'insensitive' },
            },
          },
        },
        {
          employee: {
            employeeCode: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.attendance.findMany({
        where,
        include: {
          employee: {
            include: { user: true },
          },
          branch: true,
        },
        orderBy: { date: 'desc' },
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      data: data.map((a) => ({
        ...a,
        totalHours: a.totalHours?.toNumber(),
        overtimeHours: a.overtimeHours?.toNumber(),
      })),
      total,
    };
  }
}

