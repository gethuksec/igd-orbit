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
import { ShiftsService } from '../../shifts/shifts.service';
import { ClockInDto } from '../dto/clock-in.dto';
import { ClockOutDto } from '../dto/clock-out.dto';
import { resolveStreetLabel } from './street-geocode';
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

/**
 * WS-290: mobile clock distance check that does NOT throw when outside the
 * radius — returns { outside } so the caller can record a pending
 * luar-lokasi approval instead (alasan mandatory). GPS + selfie presence
 * is still enforced exactly like assertMobileClockProof.
 */
export function mobileClockOutside(
  dto: MobileClockProof,
  branch: { latitude?: unknown; longitude?: unknown; attendanceRadiusM?: unknown },
): { outside: boolean; distanceMeters: number | null } {
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
    return { outside: false, distanceMeters: null }; // branch not geotagged → check skipped
  }
  const radius = Number(branch.attendanceRadiusM ?? 100);
  const distanceMeters = Math.round(haversineMeters(Number(dto.latitude), Number(dto.longitude), bLat, bLng));
  return { outside: distanceMeters > radius, distanceMeters };
}

export interface ClockAnchor {
  latitude?: unknown;
  longitude?: unknown;
  attendanceRadiusM?: unknown;
  radiusM?: unknown;
  name?: string;
}

export function clockAnchorRadius(a: ClockAnchor): number {
  const raw = (a as any).attendanceRadiusM ?? (a as any).radiusM ?? 100;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 100;
}

/**
 * IGDERP-305: ANY-match across all resolved anchors. Inside when within at
 * least one anchor radius; outside only when outside EVERY tagged anchor.
 * No tagged anchor at all → { outside: false } (legacy skip). GPS + selfie
 * presence enforced exactly like mobileClockOutside.
 */
export function isOutsideAllAnchors(
  dto: MobileClockProof,
  anchors: ClockAnchor[],
): { outside: boolean; distanceMeters: number | null } {
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
  const tagged = (anchors ?? []).filter((a) => {
    if (!a) return false;
    const lat = a.latitude == null ? null : Number(a.latitude);
    const lng = a.longitude == null ? null : Number(a.longitude);
    return lat !== null && lng !== null && !Number.isNaN(lat) && !Number.isNaN(lng);
  });
  if (!tagged.length) return { outside: false, distanceMeters: null };
  let nearest: number | null = null;
  for (const a of tagged) {
    const d = Math.round(
      haversineMeters(Number(dto.latitude), Number(dto.longitude), Number(a.latitude), Number(a.longitude)),
    );
    if (nearest === null || d < nearest) nearest = d;
    if (d <= clockAnchorRadius(a)) return { outside: false, distanceMeters: nearest };
  }
  return { outside: true, distanceMeters: nearest };
}

/**
 * IGDERP-307: business wall time is Asia/Jakarta (WIB, UTC+7); the server
 * runs UTC. Shift/operating-hours comparisons must use WIB instants —
 * comparing server-local wall time marks a 13:58 WIB clock "on time"
 * (06:58 UTC < 08:00). Explicit +7 offset, same convention as IGDERP-136/S2.
 */
export const WIB_OFFSET_MS = 7 * 3600 * 1000;

export function wibParts(date: Date) {
  const w = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    y: w.getUTCFullYear(),
    m: w.getUTCMonth(),
    d: w.getUTCDate(),
    hh: w.getUTCHours(),
    mm: w.getUTCMinutes(),
    weekday: w.getUTCDay(), // 0=Sun..6=Sat, WIB wall
  };
}

/** Instant a WIB 'HH:MM' wall time occurs on the business day of `date`. */
export function wibTimeInstant(date: Date, hhmm: string): Date {
  const { y, m, d } = wibParts(date);
  const [hh, mm] = String(hhmm).split(':').map(Number);
  return new Date(Date.UTC(y, m, d, hh, mm) - WIB_OFFSET_MS);
}

/**
 * `date` shifted so server-local getters read WIB wall fields. The box runs
 * Etc/UTC (verified), so getDay/setHours on the shifted instant evaluate
 * WIB parts — used only to feed UTC-naive legacy resolvers.
 */
export function asWibLocal(date: Date): Date {
  return new Date(date.getTime() + WIB_OFFSET_MS);
}

@Injectable()
export class AttendanceService {
  private readonly storage = new StorageService();

  constructor(
    private prisma: PrismaService,
    private shifts: ShiftsService,
  ) {}

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
   * IGDERP-305: resolve every radius anchor for a mobile clock — the
   * selected branch (when geotagged), working locations linked to that
   * branch, and the employee's active-contract working locations (e.g. HQ
   * Jember for Pusat staff whose outlet branch was never geotagged, so a
   * branch-only check silently skips and luar-lokasi never becomes pending).
   */
  private async resolveClockAnchors(
    employeeId: string,
    branch: { id: string; latitude?: unknown; longitude?: unknown; attendanceRadiusM?: unknown },
  ): Promise<ClockAnchor[]> {
    const anchors: ClockAnchor[] = [];
    if (branch) anchors.push(branch);
    try {
      const db = this.prisma as any;
      if (typeof db.workingLocation?.findMany === 'function') {
        const linked: any[] = await db.workingLocation.findMany({
          where: { branchId: branch.id, isActive: true },
        });
        anchors.push(...linked);
      }
    } catch {
      // legacy DB without working_locations → branch anchor only
    }
    try {
      const db = this.prisma as any;
      if (typeof db.contract?.findMany === 'function' && typeof db.contractWorkingLocation?.findMany === 'function') {
        const contracts: any[] = await db.contract.findMany({
          where: { employeeId, status: 'active' },
          select: { id: true },
        });
        const ids = contracts.map((c) => c.id);
        if (ids.length) {
          const links: any[] = await db.contractWorkingLocation.findMany({
            where: { contractId: { in: ids } },
            include: { workingLocation: true },
          });
          for (const l of links) {
            if (l?.workingLocation && l.workingLocation.isActive !== false) anchors.push(l.workingLocation);
          }
        }
      }
    } catch {
      // contract anchors are optional enrichment
    }
    return anchors;
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

    // IGDERP-305: mobile clock outside EVERY known anchor (branch +
    // branch-linked + active-contract working locations) no longer
    // hard-rejects — with mandatory alasan it records a pending luar-lokasi
    // approval instead. No tagged anchor at all → check skipped (legacy).
    const isMobile = dto.method === 'mobile';
    let pendingApproval = false;
    if (isMobile) {
      const anchors = await this.resolveClockAnchors(employee.id, branch as any);
      const check = isOutsideAllAnchors(dto, anchors);
      if (check.outside) {
        if (!dto.notes || !dto.notes.trim()) {
          throw new BadRequestException('Alasan wajib diisi untuk absen di luar lokasi');
        }
        pendingApproval = true;
      }
    }

    // Calculate if late — IGDERP-265 Q6 (roster-first): resolved shift time
    // wins; roster libur day never counts late; branch hours are fallback.
    // IGDERP-307: wall-time comparisons in WIB (server is UTC).
    const now = new Date();
    let isLate = false;
    let lateMinutes = 0;

    const resolved = await this.shifts.resolveShiftForDate(employee.id, asWibLocal(now)).catch(() => null);
    if (resolved && (resolved.source === 'roster-libur' || (resolved as any).offDate)) {
      isLate = false;
      lateMinutes = 0;
    } else if (resolved?.shift) {
      const expectedStart = wibTimeInstant(now, resolved.shift.clockIn);
      const tolerance = resolved.shift.lateToleranceMin ?? 15;
      if (now.getTime() > expectedStart.getTime()) {
        const diffMs = now.getTime() - expectedStart.getTime();
        lateMinutes = Math.floor(diffMs / (1000 * 60));
        if (lateMinutes > tolerance) {
          isLate = true;
        } else {
          lateMinutes = 0;
        }
      }
    } else if (branch.operatingHours) {
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
        wibParts(now).weekday
      ];
      const operatingHours = branch.operatingHours as any;
      const dayHours = operatingHours[dayName];

      if (dayHours && dayHours.open) {
        const expectedStart = wibTimeInstant(now, dayHours.open);

        if (now.getTime() > expectedStart.getTime()) {
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

    // Street name stored at clock time (reverse-geocode; null on any
    // failure so a geocode outage never blocks the clock tap).
    let clockInStreet: string | null = null;
    if (dto.latitude != null && dto.longitude != null) {
      clockInStreet = await resolveStreetLabel(dto.latitude, dto.longitude);
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
        ...(dto.latitude != null && dto.longitude != null ? { clockInStreet } : {}),
        clockInPhotoUrl: dto.photoUrl ?? undefined,
        clockInLat: dto.latitude != null ? new Decimal(dto.latitude) : undefined,
        clockInLng: dto.longitude != null ? new Decimal(dto.longitude) : undefined,
        internalNotes: dto.notes,
        isLate,
        lateMinutes,
        status: 'present',
        ...(pendingApproval ? { approvalStatus: 'pending' } : {}),
        updatedAt: new Date(),
      },
      create: {
        employeeId: employee.id,
        date: today,
        branchId: dto.branch_id,
        clockIn: now,
        clockInMethod: dto.method,
        clockInLocation: dto.clock_in_location,
        clockInStreet: clockInStreet ?? undefined,
        clockInPhotoUrl: dto.photoUrl ?? undefined,
        clockInLat: dto.latitude != null ? new Decimal(dto.latitude) : undefined,
        clockInLng: dto.longitude != null ? new Decimal(dto.longitude) : undefined,
        internalNotes: dto.notes,
        status: 'present',
        isLate,
        lateMinutes,
        approvalStatus: pendingApproval ? 'pending' : 'none',
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

    // IGDERP-305: mobile clock-out outside every known anchor → pending
    // approval (alasan mandatory). A record already pending from clock-in
    // stays pending. No tagged anchor at all → check skipped (legacy).
    let clockOutOutside = false;
    if (dto.method === 'mobile') {
      const anchors = await this.resolveClockAnchors(attendance.employeeId, attendance.branch as any);
      const check = isOutsideAllAnchors(dto, anchors);
      clockOutOutside = check.outside;
      if (check.outside) {
        if (!dto.notes || !dto.notes.trim()) {
          throw new BadRequestException('Alasan wajib diisi untuk absen di luar lokasi');
        }
      }
    }

    // Calculate work hours
    const now = new Date();
    const clockInTime = attendance.clockIn;
    const diffMs = now.getTime() - clockInTime.getTime();
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const breakTimeHours = attendance.breakTime || new Decimal(1);
    const workHours = new Decimal(totalMinutes / 60).minus(breakTimeHours);

    // Calculate early leave (IGDERP-307: WIB wall time, server is UTC).
    let isEarlyLeave = false;
    let earlyLeaveMinutes = 0;

    if (attendance.branch.operatingHours) {
      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
        wibParts(now).weekday
      ];
      const operatingHours = attendance.branch.operatingHours as any;
      const dayHours = operatingHours[dayName];

      if (dayHours && dayHours.close) {
        const expectedEnd = wibTimeInstant(now, dayHours.close);

        if (now.getTime() < expectedEnd.getTime()) {
          const diffMs = expectedEnd.getTime() - now.getTime();
          earlyLeaveMinutes = Math.floor(diffMs / (1000 * 60));
          isEarlyLeave = true;
        }
      }
    }

    // Street name stored at clock time (same failure tolerance as clock-in).
    let clockOutStreet: string | null = null;
    if (dto.latitude != null && dto.longitude != null) {
      clockOutStreet = await resolveStreetLabel(dto.latitude, dto.longitude);
    }

    // Update attendance
    const updated = await this.prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOut: now,
        clockOutMethod: dto.method,
        clockOutLocation: dto.clock_out_location,
        ...(dto.latitude != null && dto.longitude != null ? { clockOutStreet } : {}),
        clockOutPhotoUrl: dto.photoUrl ?? undefined,
        clockOutLat: dto.latitude != null ? new Decimal(dto.latitude) : undefined,
        clockOutLng: dto.longitude != null ? new Decimal(dto.longitude) : undefined,
        internalNotes: dto.notes ? (attendance.internalNotes ? `${attendance.internalNotes}\n[Clock Out] ${dto.notes}` : `[Clock Out] ${dto.notes}`) : attendance.internalNotes,
        isEarlyLeave,
        earlyLeaveMinutes,
        totalHours: workHours.greaterThan(0) ? workHours : new Decimal(0),
        ...(clockOutOutside ? { approvalStatus: 'pending' } : {}),
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
   * WS-290: daily presensi roster — every active employee (branch-scoped)
   * with their attendance record (if any), resolved shift schedule and a
   * display status in {hadir, terlambat, alpha, cuti, libur}.
   * needsApproval = record.approvalStatus === 'pending' (luar lokasi).
   */
  async getRoster(
    dateInput: Date | string,
    opts: {
      userId?: string;
      branchId?: string;
      branchIds?: string[];
      search?: string;
      status?: string;
    } = {},
  ) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);

    const empWhere: any = { isActive: true };
    if (opts.branchId) {
      empWhere.branchId = opts.branchId;
    } else if (opts.branchIds?.length) {
      empWhere.branchId = { in: opts.branchIds };
    }
    if (opts.search) {
      empWhere.OR = [
        { user: { fullName: { contains: opts.search, mode: 'insensitive' } } },
        { employeeCode: { contains: opts.search, mode: 'insensitive' } },
      ];
    }
    if (opts.userId) {
      const self = await this.prisma.employee.findUnique({ where: { userId: opts.userId } });
      empWhere.id = self ? self.id : '__none__';
    }

    const employees: any[] = await this.prisma.employee.findMany({
      where: empWhere,
      include: {
        user: true,
        branch: true,
        position: { select: { rank: true, defaultShiftId: true } },
        defaultShift: true,
      },
      orderBy: { employeeCode: 'asc' },
    });
    const ids = employees.map((e) => e.id);
    if (!ids.length) {
      return { date: day, data: [], counts: { hadir: 0, terlambat: 0, alpha: 0, cuti: 0, libur: 0 }, total: 0 };
    }

    const db = this.prisma as any;
    const [entries, assignments, records, leaves] = await Promise.all([
      db.shiftRosterEntry.findMany({
        where: { employeeId: { in: ids }, date: day },
        include: { shift: true },
      }),
      db.shiftAssignment.findMany({
        where: {
          employeeId: { in: ids },
          startDate: { lte: day },
          OR: [{ endDate: null }, { endDate: { gte: day } }],
        },
        include: { shift: true },
      }),
      this.prisma.attendance.findMany({
        where: { employeeId: { in: ids }, date: day },
        include: { branch: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: ids },
          status: 'approved',
          startDate: { lte: day },
          endDate: { gte: day },
        },
        select: { employeeId: true },
      }),
    ]);

    // Title-default shifts (position.defaultShiftId) in one query.
    const titleShiftIds = [...new Set(employees.map((e) => e.position?.defaultShiftId).filter(Boolean))];
    const titleShifts = titleShiftIds.length
      ? await db.shift.findMany({ where: { id: { in: titleShiftIds }, deletedAt: null } })
      : [];
    const titleShiftById = new Map(titleShifts.map((s: any) => [s.id, s]));

    const entryByEmp = new Map(entries.map((r: any) => [r.employeeId, r]));
    const assignByEmp = new Map<string, any[]>();
    for (const a of assignments) {
      if (!assignByEmp.has(a.employeeId)) assignByEmp.set(a.employeeId, []);
      assignByEmp.get(a.employeeId)!.push(a);
    }
    const recByEmp = new Map(records.map((r: any) => [r.employeeId, r]));
    const leaveSet = new Set(leaves.map((l: any) => l.employeeId));
    const weekday = ((day.getDay() + 6) % 7) + 1; // 1=Mon..7=Sun

    const schedOf = (shift: any) =>
      shift && shift.deletedAt === null
        ? { in: shift.clockIn ?? null, out: shift.clockOut ?? null, name: shift.name ?? null }
        : null;

    const all = employees.map((e) => {
      const rec = recByEmp.get(e.id);
      let schedule = { in: null as string | null, out: null as string | null, name: null as string | null };
      let libur = false;
      const exempt = e.position && e.position.rank <= 2; // L1-2: no shift hours
      if (!exempt) {
        const entry: any = entryByEmp.get(e.id);
        if (entry) {
          if (!entry.shiftId) {
            libur = true;
          } else {
            const s = schedOf(entry.shift);
            if (s) schedule = s;
          }
        } else {
          const hit = (assignByEmp.get(e.id) ?? []).find((a) => (a.weekdays ?? []).includes(weekday));
          if (hit?.shift && hit.shift.deletedAt === null) {
            const off = (hit.offDates ?? []).some(
              (x: Date | string) => new Date(x).toDateString() === day.toDateString(),
            );
            if (off) {
              libur = true;
            } else {
              schedule = schedOf(hit.shift)!;
            }
          } else if (e.defaultShift && e.defaultShift.deletedAt === null) {
            schedule = schedOf(e.defaultShift)!;
          } else if (e.position?.defaultShiftId) {
            const s = schedOf(titleShiftById.get(e.position.defaultShiftId));
            if (s) schedule = s;
          }
        }
      }

      let displayStatus: string;
      if (rec) {
        // IGDERP-305: luar-lokasi pending counts as alpha (default alpha →
        // hadir only after ACC atasan langsung), so it never inflates hadir.
        if ((rec as any).approvalStatus === 'pending') displayStatus = 'alpha';
        else if (rec.status === 'present') displayStatus = rec.isLate ? 'terlambat' : 'hadir';
        else if (rec.status === 'absent') displayStatus = 'alpha';
        else if (rec.status === 'leave') displayStatus = 'cuti';
        else if (rec.status === 'holiday') displayStatus = 'libur';
        else displayStatus = 'hadir';
      } else if (libur) {
        displayStatus = 'libur';
      } else if (leaveSet.has(e.id)) {
        displayStatus = 'cuti';
      } else {
        displayStatus = 'alpha';
      }

      return {
        id: rec?.id ?? `missing-${e.id}`,
        employeeId: e.id,
        date: day,
        displayStatus,
        status: rec?.status ?? null,
        clockIn: rec?.clockIn ?? null,
        clockOut: rec?.clockOut ?? null,
        clockInLocation: rec?.clockInLocation ?? null,
        clockOutLocation: rec?.clockOutLocation ?? null,
        clockInStreet: (rec as any)?.clockInStreet ?? null,
        clockOutStreet: (rec as any)?.clockOutStreet ?? null,
        clockInMethod: rec?.clockInMethod ?? null,
        clockOutMethod: rec?.clockOutMethod ?? null,
        scheduleIn: schedule.in,
        scheduleOut: schedule.out,
        shiftName: schedule.name,
        isLate: rec?.isLate ?? false,
        lateMinutes: rec?.lateMinutes ?? 0,
        isEarlyLeave: rec?.isEarlyLeave ?? false,
        earlyLeaveMinutes: rec?.earlyLeaveMinutes ?? 0,
        totalHours: rec?.totalHours?.toNumber?.() ?? null,
        clockInLat: rec?.clockInLat?.toNumber?.() ?? null,
        clockInLng: rec?.clockInLng?.toNumber?.() ?? null,
        clockOutLat: rec?.clockOutLat?.toNumber?.() ?? null,
        clockOutLng: rec?.clockOutLng?.toNumber?.() ?? null,
        clockInPhotoUrl: rec?.clockInPhotoUrl ?? null,
        clockOutPhotoUrl: rec?.clockOutPhotoUrl ?? null,
        needsApproval: (rec as any)?.approvalStatus === 'pending',
        approvalStatus: (rec as any)?.approvalStatus ?? 'none',
        note: rec?.internalNotes ?? null,
        employee: { id: e.id, employeeCode: e.employeeCode, user: e.user ? { fullName: e.user.fullName } : null },
        branch: rec?.branch ?? e.branch ?? null,
      };
    });

    const counts = { hadir: 0, terlambat: 0, alpha: 0, cuti: 0, libur: 0 };
    for (const r of all) {
      if ((counts as any)[r.displayStatus] !== undefined) (counts as any)[r.displayStatus] += 1;
    }
    const q = (opts.status || '').toLowerCase();
    const data = q && q !== 'all' ? all.filter((r) => r.displayStatus === q) : all;
    return { date: day, data, counts, total: data.length };
  }

  /**
   * WS-290: approve a pending luar-lokasi attendance (atasan: HS/SPV/CHR).
   * Status stays as recorded; approval clears the pending flag.
   */
  async approveAttendance(id: string, userId: string, userRoles: string[], reason?: string) {
    const hasPermission = ['HS', 'SPV', 'CHR', 'SUPERADMIN'].some((role) => userRoles.includes(role));
    if (!hasPermission) {
      throw new ForbiddenException('Only HS, SPV, or CHR can approve presensi');
    }
    const rec = await this.prisma.attendance.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Attendance record not found');
    if ((rec as any).approvalStatus !== 'pending') {
      throw new BadRequestException('Attendance ini tidak menunggu persetujuan');
    }
    return this.prisma.attendance.update({
      where: { id },
      data: {
        approvalStatus: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        adjustedBy: userId,
        adjustmentReason: reason || 'Disetujui atasan',
        updatedAt: new Date(),
      } as any,
      include: { employee: { include: { user: true } }, branch: true },
    });
  }

  /**
   * WS-290: reject a pending luar-lokasi attendance — falls back to alpha.
   */
  async rejectAttendance(id: string, userId: string, userRoles: string[], reason?: string) {
    const hasPermission = ['HS', 'SPV', 'CHR', 'SUPERADMIN'].some((role) => userRoles.includes(role));
    if (!hasPermission) {
      throw new ForbiddenException('Only HS, SPV, or CHR can reject presensi');
    }
    const rec = await this.prisma.attendance.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException('Attendance record not found');
    if ((rec as any).approvalStatus !== 'pending') {
      throw new BadRequestException('Attendance ini tidak menunggu persetujuan');
    }
    return this.prisma.attendance.update({
      where: { id },
      data: {
        approvalStatus: 'rejected',
        status: 'absent',
        approvedBy: userId,
        approvedAt: new Date(),
        adjustedBy: userId,
        adjustmentReason: reason || 'Ditolak atasan',
        updatedAt: new Date(),
      } as any,
      include: { employee: { include: { user: true } }, branch: true },
    });
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

