import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { StorageService } from '../../../shared/services/storage.service';
import { assertFileMagic } from '../../../shared/utils/file-magic';
import { extname } from 'path';
import { ClockInDto } from '../dto/clock-in.dto';
import { ClockOutDto } from '../dto/clock-out.dto';
import { ManualAdjustmentDto } from '../dto/manual-adjustment.dto';
import { OvertimeRequestDto } from '../dto/overtime-request.dto';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * IGDERP-275: haversine distance in meters between two WGS84 points.
 * Exported for unit tests.
 */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface MobileClockProof {
  latitude?: number;
  longitude?: number;
  photoUrl?: string;
}

/**
 * IGDERP-275: mobile clock requires selfie photo + GPS. Branches without
 * geotag (latitude/longitude null) skip the radius check so legacy data
 * keeps working; the PWA must still send proof.
 * Throws BadRequestException carrying distance info for the "di luar lokasi" popup.
 */
export function assertMobileClockProof(
  dto: MobileClockProof,
  branch: { latitude?: unknown; longitude?: unknown; attendanceRadiusM?: unknown; name?: string },
): { distanceMeters: number | null } {
  if (
    dto.latitude === undefined ||
    dto.latitude === null ||
    dto.longitude === undefined ||
    dto.longitude === null
  ) {
    throw new BadRequestException('Lokasi GPS wajib untuk absen via HP');
  }
  if (!dto.photoUrl) {
    throw new BadRequestException('Foto selfie wajib untuk absen via HP');
  }
  const bLat = branch.latitude == null ? null : Number(branch.latitude);
  const bLng = branch.longitude == null ? null : Number(branch.longitude);
  if (bLat === null || bLng === null || Number.isNaN(bLat) || Number.isNaN(bLng)) {
    return { distanceMeters: null }; // branch not geotagged → check skipped
  }
  const radius = Number(branch.attendanceRadiusM ?? 100);
  const distanceMeters = Math.round(haversineMeters(Number(dto.latitude), Number(dto.longitude), bLat, bLng));
  if (distanceMeters > radius) {
    throw new BadRequestException(
      `Di luar lokasi: ${distanceMeters}m dari ${branch.name || 'cabang'} (radius ${radius}m)`,
    );
  }
  return { distanceMeters };
}

@Injectable()
export class AttendanceService {
  private readonly storage = new StorageService();

  constructor(private prisma: PrismaService) {}

  /**
   * IGDERP-275: selfie upload for mobile clock in/out.
   * Returns the public URL the PWA then sends as photoUrl. Max 2MB (phone
   * front cameras); the PWA should compress client-side before upload.
   */
  async uploadSelfie(
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer } | undefined,
    userId: string,
  ) {
    if (!file || !file.buffer || file.size === 0) {
      throw new BadRequestException('Foto selfie wajib diunggah');
    }
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File selfie wajib gambar: ' + (file.originalname || 'tanpa nama'));
    }
    if (file.size > 2 * 1024 * 1024) {
      throw new BadRequestException('Maksimal 2MB per foto selfie: ' + (file.originalname || 'tanpa nama'));
    }
    assertFileMagic(file.buffer, file.mimetype, file.originalname || 'selfie');
    const ext = (extname(file.originalname || '').toLowerCase() || '.jpg').replace(/[^a-z0-9.]/g, '') || '.jpg';
    const name = `selfie-${userId}-${Date.now()}${ext}`;
    const url = this.storage.save('attendance-selfies', name, file.buffer);
    return { url };
  }

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

    // IGDERP-275: mobile clock requires selfie + GPS inside branch radius
    const isMobile = dto.method === 'mobile';
    if (isMobile) {
      assertMobileClockProof(dto, branch as any);
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
        clockInPhotoUrl: dto.photoUrl ?? undefined,
        clockInLat: dto.latitude != null ? new Decimal(dto.latitude) : undefined,
        clockInLng: dto.longitude != null ? new Decimal(dto.longitude) : undefined,
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
        clockInPhotoUrl: dto.photoUrl ?? undefined,
        clockInLat: dto.latitude != null ? new Decimal(dto.latitude) : undefined,
        clockInLng: dto.longitude != null ? new Decimal(dto.longitude) : undefined,
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

    // IGDERP-275: mobile clock-out requires selfie + GPS inside branch radius
    if (dto.method === 'mobile') {
      assertMobileClockProof(dto, attendance.branch as any);
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
        clockOutPhotoUrl: dto.photoUrl ?? undefined,
        clockOutLat: dto.latitude != null ? new Decimal(dto.latitude) : undefined,
        clockOutLng: dto.longitude != null ? new Decimal(dto.longitude) : undefined,
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
   * Approve overtime — step 1 (manager: HS/SPV).
   * IGDERP-275: pending → manager_approved. Final approval is step 2 (CHR).
   */
  async approveOvertime(overtimeId: string, userId: string, userRoles: string[]) {
    // Check permission
    const hasPermission = ['HS', 'SPV'].some((role) => userRoles.includes(role));
    if (!hasPermission) {
      throw new ForbiddenException('Only HS or SPV can approve overtime (step 1)');
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

    if (overtimeRequest.requestedBy === userId) {
      throw new ForbiddenException('Requester cannot approve their own overtime');
    }

    return this.prisma.overtimeRequest.update({
      where: { id: overtimeId },
      data: {
        status: 'manager_approved',
        managerApprovedBy: userId,
        managerApprovedAt: new Date(),
      },
    });
  }

  /**
   * Approve overtime — step 2 (HR: CHR). Finalizes the request and
   * stamps the linked attendance row.
   * IGDERP-275: manager_approved → approved.
   */
  async approveOvertimeHr(overtimeId: string, userId: string, userRoles: string[]) {
    const hasPermission = ['CHR'].some((role) => userRoles.includes(role));
    if (!hasPermission) {
      throw new ForbiddenException('Only CHR can finalize overtime approval (step 2)');
    }

    const overtimeRequest = await this.prisma.overtimeRequest.findUnique({
      where: { id: overtimeId },
      include: { attendance: true },
    });

    if (!overtimeRequest) {
      throw new NotFoundException('Overtime request not found');
    }

    if (overtimeRequest.status !== 'manager_approved') {
      throw new BadRequestException('Overtime request needs manager approval first');
    }

    // Update overtime request
    const updatedRequest = await this.prisma.overtimeRequest.update({
      where: { id: overtimeId },
      data: {
        status: 'approved',
        hrApprovedBy: userId,
        hrApprovedAt: new Date(),
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
   * Reject overtime — step 1 rejects `pending` (HS/SPV), step 2 rejects
   * `manager_approved` (CHR). IGDERP-275.
   */
  async rejectOvertime(overtimeId: string, reason: string, userId: string, userRoles: string[]) {
    const isManager = ['HS', 'SPV'].some((role) => userRoles.includes(role));
    const isHr = ['CHR'].some((role) => userRoles.includes(role));
    if (!isManager && !isHr) {
      throw new ForbiddenException('Only HS, SPV, or CHR can reject overtime');
    }

    const overtimeRequest = await this.prisma.overtimeRequest.findUnique({
      where: { id: overtimeId },
    });

    if (!overtimeRequest) {
      throw new NotFoundException('Overtime request not found');
    }

    const canReject =
      (isManager && overtimeRequest.status === 'pending') ||
      (isHr && ['pending', 'manager_approved'].includes(overtimeRequest.status));
    if (!canReject) {
      throw new BadRequestException('Overtime request is not awaiting your decision');
    }

    return this.prisma.overtimeRequest.update({
      where: { id: overtimeId },
      data: {
        status: 'rejected',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });
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
    branchIds?: string[],
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
    } else if (branchIds?.length) {
      // "Semua Cabang" → user's accessible branches only
      where.branchId = { in: branchIds };
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

    const data = await this.prisma.attendance.findMany({
      where,
      include: {
        employee: {
          include: { user: true },
        },
        branch: true,
      },
      orderBy: { date: 'desc' },
    });

    const rows = data.map((a) => ({
      ...a,
      totalHours: a.totalHours?.toNumber(),
      overtimeHours: a.overtimeHours?.toNumber(),
    }));

    // Single-day coverage: append employees with no record as "not-clocked"
    // rows so the Presensi default view shows everyone (clocked or not).
    const sameDay =
      startDate && endDate && startDate.toDateString() === endDate.toDateString();
    if (sameDay && !employeeId && !userId && (!status || status === 'all' || status === 'not-clocked')) {
      const empWhere: any = { isActive: true };
      if (branchId) {
        empWhere.branchId = branchId;
      } else if (branchIds?.length) {
        empWhere.branchId = { in: branchIds };
      }
      if (search) {
        empWhere.OR = [
          { user: { fullName: { contains: search, mode: 'insensitive' } } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
        ];
      }
      const employees = await this.prisma.employee.findMany({
        where: empWhere,
        include: { user: true, branch: true },
        orderBy: { employeeCode: 'asc' },
      });
      const seen = new Set(data.map((a) => a.employeeId));
      for (const e of employees) {
        if (seen.has(e.id)) continue;
        rows.push({
          id: `missing-${e.id}`,
          employeeId: e.id,
          date: startDate,
          status: 'not-clocked',
          clockIn: null,
          clockOut: null,
          totalHours: 0,
          overtimeHours: 0,
          employee: e,
          branch: (e as any).branch ?? null,
        } as any);
      }
    }

    return { data: rows, total: rows.length };
  }

  /**
   * List overtime requests (approval queue).
   */
  async listOvertimeRequests(status?: string) {
    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    const rows = await this.prisma.overtimeRequest.findMany({
      where,
      include: {
        employee: { include: { user: true } },
        attendance: true,
      },
      orderBy: { date: 'desc' },
    });
    return rows.map((r) => ({
      ...r,
      hours: (r.hours as any)?.toNumber?.() ?? r.hours,
      estimatedAmount: (r.estimatedAmount as any)?.toNumber?.() ?? null,
    }));
  }
}

