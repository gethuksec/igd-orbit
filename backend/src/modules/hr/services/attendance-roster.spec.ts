import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { FileTokenService } from '../../../shared/services/file-token.service';
import { ShiftsService } from '../../shifts/shifts.service';
import { AttendanceService, mobileClockOutside, isOutsideAllAnchors, wibParts, wibTimeInstant } from './attendance.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * WS-290: presensi roster (all employees + schedule + display status),
 * luar-lokasi pending flow and atasan approve/reject (mocked Prisma).
 */
describe('AttendanceService roster + luar-lokasi approval (WS-290)', () => {
  let service: AttendanceService;
  let prisma: any;

  const DAY = new Date(2026, 10, 23); // Monday
  const emp = (id: string, over: any = {}) => ({
    id,
    employeeCode: `EMP-${id}`,
    isActive: true,
    branchId: 'b-1',
    user: { fullName: `Name ${id}` },
    branch: { id: 'b-1', name: 'Outlet A' },
    position: null,
    defaultShift: null,
    ...over,
  });
  const shiftPagi = { id: 's-1', name: 'Pagi', clockIn: '08:00', clockOut: '17:00', deletedAt: null };

  beforeEach(async () => {
    prisma = {
      employee: { findUnique: jest.fn(), findMany: jest.fn() },
      attendance: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() },
      leaveRequest: { findMany: jest.fn() },
      shiftRosterEntry: { findMany: jest.fn().mockResolvedValue([]) },
      shiftAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      shift: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        FileTokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: ShiftsService, useValue: { resolveShiftForDate: jest.fn(async () => null) } },
      ],
    }).compile();
    service = module.get<AttendanceService>(AttendanceService);
  });

  const baseRosterMocks = (employees: any[], records: any[] = [], opts: any = {}) => {
    prisma.employee.findMany.mockResolvedValue(employees);
    prisma.attendance.findMany.mockResolvedValue(records);
    prisma.leaveRequest.findMany.mockResolvedValue(opts.leaves ?? []);
    prisma.shiftRosterEntry.findMany.mockResolvedValue(opts.entries ?? []);
    prisma.shiftAssignment.findMany.mockResolvedValue(opts.assignments ?? []);
    prisma.shift.findMany.mockResolvedValue(opts.titleShifts ?? []);
  };

  describe('getRoster', () => {
    it('lists every active employee even without a record (missing → alpha)', async () => {
      baseRosterMocks([emp('e1'), emp('e2')]);
      const res: any = await service.getRoster(DAY, {});
      expect(res.total).toBe(2);
      expect(res.data[0]).toMatchObject({ employeeId: 'e1', displayStatus: 'alpha', id: 'missing-e1' });
      expect(res.counts).toMatchObject({ alpha: 2, hadir: 0 });
    });

    it('maps present+late → terlambat, present on-time → hadir', async () => {
      baseRosterMocks([emp('e1'), emp('e2')], [
        { id: 'a1', employeeId: 'e1', status: 'present', isLate: true, lateMinutes: 25, clockIn: new Date(), approvalStatus: 'none' },
        { id: 'a2', employeeId: 'e2', status: 'present', isLate: false, clockIn: new Date(), approvalStatus: 'none' },
      ]);
      const res: any = await service.getRoster(DAY, {});
      expect(res.data.find((r: any) => r.employeeId === 'e1').displayStatus).toBe('terlambat');
      expect(res.data.find((r: any) => r.employeeId === 'e2').displayStatus).toBe('hadir');
      expect(res.counts).toMatchObject({ terlambat: 1, hadir: 1 });
    });

    it('maps absent/leave/holiday records → alpha/cuti/libur', async () => {
      baseRosterMocks([emp('e1'), emp('e2'), emp('e3')], [
        { id: 'a1', employeeId: 'e1', status: 'absent', approvalStatus: 'none' },
        { id: 'a2', employeeId: 'e2', status: 'leave', approvalStatus: 'none' },
        { id: 'a3', employeeId: 'e3', status: 'holiday', approvalStatus: 'none' },
      ]);
      const res: any = await service.getRoster(DAY, {});
      const byId = Object.fromEntries(res.data.map((r: any) => [r.employeeId, r.displayStatus]));
      expect(byId).toEqual({ e1: 'alpha', e2: 'cuti', e3: 'libur' });
    });

    it('missing record on roster-libur day → libur; on approved leave → cuti', async () => {
      baseRosterMocks([emp('e1'), emp('e2'), emp('e3')], [], {
        entries: [{ employeeId: 'e1', date: DAY, shiftId: null, shift: null }],
        leaves: [{ employeeId: 'e2' }],
      });
      const res: any = await service.getRoster(DAY, {});
      const byId = Object.fromEntries(res.data.map((r: any) => [r.employeeId, r.displayStatus]));
      expect(byId).toEqual({ e1: 'libur', e2: 'cuti', e3: 'alpha' });
    });

    it('IGDERP-315: roster leave overlay covers approved + manager_approved', async () => {
      baseRosterMocks([emp('e1')], [], { leaves: [{ employeeId: 'e1' }] });
      const res: any = await service.getRoster(DAY, {});
      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: { in: ['approved', 'manager_approved'] } }),
        }),
      );
      // Step-1-approved leave already signals cuti on the roster, before
      // CHR writes the attendance placeholder rows at step 2.
      expect(res.data.find((r: any) => r.employeeId === 'e1').displayStatus).toBe('cuti');
    });

    it('resolves schedule roster-first: entry shift wins over assignment', async () => {
      const assignShift = { id: 's-9', name: 'Siang', clockIn: '13:00', clockOut: '21:00', deletedAt: null };
      baseRosterMocks([emp('e1')], [], {
        entries: [{ employeeId: 'e1', date: DAY, shiftId: 's-1', shift: shiftPagi }],
        assignments: [{ employeeId: 'e1', weekdays: [1], offDates: [], shift: assignShift }],
      });
      const res: any = await service.getRoster(DAY, {});
      expect(res.data[0]).toMatchObject({ scheduleIn: '08:00', scheduleOut: '17:00', shiftName: 'Pagi' });
    });

    it('falls back to assignment shift and flags needsApproval on pending records', async () => {
      const assignShift = { id: 's-9', name: 'Siang', clockIn: '13:00', clockOut: '21:00', deletedAt: null };
      baseRosterMocks([emp('e1')], [
        { id: 'a1', employeeId: 'e1', status: 'present', isLate: false, clockIn: new Date(), approvalStatus: 'pending', internalNotes: 'Servis panggilan' },
      ], {
        assignments: [{ employeeId: 'e1', weekdays: [1], offDates: [], shift: assignShift }],
      });
      const res: any = await service.getRoster(DAY, {});
      expect(res.data[0]).toMatchObject({
        scheduleIn: '13:00', scheduleOut: '21:00', shiftName: 'Siang',
        needsApproval: true, note: 'Servis panggilan',
      });
    });

    it('filters rows by display status but keeps full counts', async () => {
      baseRosterMocks([emp('e1'), emp('e2')], [
        { id: 'a1', employeeId: 'e1', status: 'present', isLate: true, approvalStatus: 'none' },
      ]);
      const res: any = await service.getRoster(DAY, { status: 'terlambat' });
      expect(res.total).toBe(1);
      expect(res.data[0].employeeId).toBe('e1');
      expect(res.counts).toMatchObject({ terlambat: 1, alpha: 1 });
    });

    it('issues signed selfie contentUrls per side; null when a side has no photo', async () => {
      baseRosterMocks([emp('e1'), emp('e2'), emp('e3')], [
        {
          id: 'a1', employeeId: 'e1', status: 'present', isLate: false, clockIn: new Date(), approvalStatus: 'none',
          clockInPhotoUrl: '/uploads/attendance-selfies/selfie-u1-1.jpg',
          clockOutPhotoUrl: '/uploads/attendance-selfies/selfie-u1-2.jpg',
        },
        {
          id: 'a2', employeeId: 'e2', status: 'present', isLate: false, clockIn: new Date(), approvalStatus: 'none',
          clockInPhotoUrl: '/uploads/attendance-selfies/selfie-u2-1.jpg',
          clockOutPhotoUrl: null,
        },
      ]);
      const res: any = await service.getRoster(DAY, {});
      const withBoth = res.data.find((r: any) => r.employeeId === 'e1');
      expect(withBoth.clockInPhotoContentUrl).toMatch(/^\/api\/v1\/files\/attendance\/a1:in\?token=.+/);
      expect(withBoth.clockOutPhotoContentUrl).toMatch(/^\/api\/v1\/files\/attendance\/a1:out\?token=.+/);
      // Token actually verifies for the bound side (proves the URL streams).
      const tokenIn = withBoth.clockInPhotoContentUrl.split('token=')[1];
      expect(() => service['fileTokens'].verify('attendance', 'a1:in', tokenIn)).not.toThrow();
      expect(() => service['fileTokens'].verify('attendance', 'a1:out', tokenIn)).toThrow();
      const inOnly = res.data.find((r: any) => r.employeeId === 'e2');
      expect(inOnly.clockInPhotoContentUrl).toMatch(/^\/api\/v1\/files\/attendance\/a2:in\?token=.+/);
      expect(inOnly.clockOutPhotoContentUrl).toBeNull();
      // Synthetic missing-* row carries no signed URLs.
      const missing = res.data.find((r: any) => r.employeeId === 'e3');
      expect(missing.id).toBe('missing-e3');
      expect(missing.clockInPhotoContentUrl).toBeNull();
      expect(missing.clockOutPhotoContentUrl).toBeNull();
    });
  });

  describe('mobileClockOutside', () => {
    const branch = { latitude: -7.25, longitude: 112.75, attendanceRadiusM: 100 };
    const proof = { latitude: -7.25, longitude: 112.75, photoUrl: 'http://x/s.jpg' };
    it('inside radius → not outside', () => {
      expect(mobileClockOutside(proof, branch)).toMatchObject({ outside: false });
    });
    it('far away → outside', () => {
      const r = mobileClockOutside({ ...proof, latitude: -7.3, longitude: 112.8 }, branch);
      expect(r.outside).toBe(true);
      expect(r.distanceMeters).toBeGreaterThan(100);
    });
    it('untagged branch → not outside, null distance', () => {
      expect(mobileClockOutside(proof, {})).toEqual({ outside: false, distanceMeters: null });
    });
    it('missing GPS/photo still throws', () => {
      expect(() => mobileClockOutside({ photoUrl: 'http://x/s.jpg' }, branch)).toThrow(BadRequestException);
      expect(() => mobileClockOutside({ latitude: -7.25, longitude: 112.75 }, branch)).toThrow(BadRequestException);
    });
  });

  describe('clockIn pending flow', () => {
    const branch = { id: 'b-1', name: 'Outlet A', latitude: -7.25, longitude: 112.75, attendanceRadiusM: 100, operatingHours: null };
    const employee = { id: 'emp-1', userId: 'u-1', isActive: true, branchId: 'b-1' };
    beforeEach(() => {
      prisma.employee.findUnique.mockResolvedValue(employee);
      prisma.branch = { findUnique: jest.fn().mockResolvedValue(branch) };
      prisma.attendance.findUnique.mockResolvedValue(null);
      prisma.attendance.upsert.mockImplementation(async ({ create }: any) => ({ id: 'att-1', ...create }));
    });
    const dto = (over: any = {}) => ({
      method: 'mobile', branch_id: 'b-1', latitude: -7.3, longitude: 112.8,
      photoUrl: 'http://x/s.jpg', ...over,
    });
    it('outside radius with alasan → approvalStatus pending', async () => {
      const res: any = await service.clockIn('u-1', dto({ notes: 'Motor mogok' }));
      const payload = prisma.attendance.upsert.mock.calls[0][0];
      expect(payload.create.approvalStatus).toBe('pending');
      expect(res.approvalStatus).toBe('pending');
    });
    it('outside radius without alasan → throws', async () => {
      await expect(service.clockIn('u-1', dto())).rejects.toThrow(BadRequestException);
    });
  });

  describe('IGDERP-305: pending luar-lokasi displays as alpha until ACC', () => {
    it('pending approvalStatus → displayStatus alpha (not hadir), counted as alpha', async () => {
      baseRosterMocks([emp('e1'), emp('e2')], [
        { id: 'a1', employeeId: 'e1', status: 'present', isLate: false, clockIn: new Date(), approvalStatus: 'pending', internalNotes: 'Dinas luar' },
        { id: 'a2', employeeId: 'e2', status: 'present', isLate: false, clockIn: new Date(), approvalStatus: 'none' },
      ]);
      const res: any = await service.getRoster(DAY, {});
      const byId = Object.fromEntries(res.data.map((r: any) => [r.employeeId, r]));
      expect(byId.e1.displayStatus).toBe('alpha');
      expect(byId.e1.needsApproval).toBe(true);
      expect(byId.e2.displayStatus).toBe('hadir');
      expect(res.counts).toMatchObject({ alpha: 1, hadir: 1 });
    });

    it('approved luar-lokasi → back to hadir', async () => {
      baseRosterMocks([emp('e1')], [
        { id: 'a1', employeeId: 'e1', status: 'present', isLate: false, clockIn: new Date(), approvalStatus: 'approved' },
      ]);
      const res: any = await service.getRoster(DAY, {});
      expect(res.data[0]).toMatchObject({ displayStatus: 'hadir', needsApproval: false, approvalStatus: 'approved' });
    });
  });

  describe('approve/reject', () => {
    it('approve: non-approver role → forbidden', async () => {
      await expect(service.approveAttendance('a1', 'u-9', ['STAFF'])).rejects.toThrow(ForbiddenException);
    });
    it('approve: non-pending record → bad request', async () => {
      prisma.attendance.findUnique.mockResolvedValue({ id: 'a1', approvalStatus: 'none' });
      await expect(service.approveAttendance('a1', 'u-9', ['SPV'])).rejects.toThrow(BadRequestException);
    });
    it('approve: pending → approved, status untouched', async () => {
      prisma.attendance.findUnique.mockResolvedValue({ id: 'a1', status: 'present', approvalStatus: 'pending' });
      prisma.attendance.update.mockImplementation(async ({ data }: any) => ({ id: 'a1', status: 'present', ...data }));
      const res: any = await service.approveAttendance('a1', 'u-9', ['SPV'], 'OK');
      expect(res.approvalStatus).toBe('approved');
      expect(res.status).toBe('present');
      expect(res.adjustmentReason).toBe('OK');
    });
    it('reject: pending → rejected + absent (alpha)', async () => {
      prisma.attendance.findUnique.mockResolvedValue({ id: 'a1', status: 'present', approvalStatus: 'pending' });
      prisma.attendance.update.mockImplementation(async ({ data }: any) => ({ id: 'a1', ...data }));
      const res: any = await service.rejectAttendance('a1', 'u-9', ['HS']);
      expect(res.approvalStatus).toBe('rejected');
      expect(res.status).toBe('absent');
    });
  });
});

/**
 * IGDERP-305: multi-anchor luar-lokasi — untagged branch + contract
 * working-location anchors (mirrors live data: all branches NULL lat/lng,
 * HQ Jember WL -8.1845,113.6687 r=100m).
 */
describe('AttendanceService IGDERP-305 anchors (WS-290 follow-up)', () => {
  const HQ = {
    id: 'wl-hq', code: 'HQ-JBR', latitude: -8.1845, longitude: 113.6687, radiusM: 100, isActive: true,
  };
  const proof = (latitude: number, longitude: number) => ({ latitude, longitude, photoUrl: 'http://x/s.jpg' });

  it('inside any one anchor → not outside (nearest distance reported)', () => {
    expect(isOutsideAllAnchors(proof(-8.1845, 113.6687), [{ latitude: null, longitude: null }, HQ])).toMatchObject({
      outside: false,
    });
  });

  it('outside every anchor → outside (QA repro ≈700m from HQ)', () => {
    const r = isOutsideAllAnchors(proof(-8.189, 113.673), [{ latitude: null, longitude: null }, HQ]);
    expect(r.outside).toBe(true);
    expect(r.distanceMeters).toBeGreaterThan(100);
  });

  it('no tagged anchor at all → legacy skip (not outside)', () => {
    expect(isOutsideAllAnchors(proof(-8.189, 113.673), [{ latitude: null, longitude: null }, {}])).toEqual({
      outside: false,
      distanceMeters: null,
    });
  });

  it('missing GPS/photo still throws', () => {
    expect(() => isOutsideAllAnchors({ photoUrl: 'http://x/s.jpg' } as any, [HQ])).toThrow(BadRequestException);
    expect(() => isOutsideAllAnchors({ latitude: -8.18, longitude: 113.66 } as any, [HQ])).toThrow(BadRequestException);
  });

  describe('clockIn resolves contract working-location anchors', () => {
    let service: AttendanceService;
    let prisma: any;
    const untaggedBranch = {
      id: 'b-1', name: 'IGD Jember Pusat', latitude: null, longitude: null, attendanceRadiusM: 100, operatingHours: null,
    };
    const employee = { id: 'emp-1', userId: 'u-1', isActive: true, branchId: 'b-1' };

    beforeEach(async () => {
      prisma = {
        employee: { findUnique: jest.fn().mockResolvedValue(employee) },
        branch: { findUnique: jest.fn().mockResolvedValue(untaggedBranch) },
        attendance: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn(async ({ create }: any) => ({ id: 'att-1', ...create })),
          update: jest.fn(),
        },
        workingLocation: { findMany: jest.fn().mockResolvedValue([]) },
        contract: { findMany: jest.fn().mockResolvedValue([{ id: 'c-1' }]) },
        contractWorkingLocation: { findMany: jest.fn().mockResolvedValue([{ workingLocation: HQ }]) },
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AttendanceService,
          FileTokenService,
          { provide: PrismaService, useValue: prisma },
          { provide: ShiftsService, useValue: { resolveShiftForDate: jest.fn(async () => null) } },
        ],
      }).compile();
      service = module.get<AttendanceService>(AttendanceService);
    });

    const dto = (over: any = {}) => ({
      method: 'mobile', branch_id: 'b-1', latitude: -8.189, longitude: 113.673, photoUrl: 'http://x/s.jpg', ...over,
    });

    it('untagged branch + contract HQ anchor: far from HQ + alasan → pending', async () => {
      const res: any = await service.clockIn('u-1', dto({ notes: 'Dinas luar' }));
      expect(prisma.attendance.upsert.mock.calls[0][0].create.approvalStatus).toBe('pending');
      expect(res.approvalStatus).toBe('pending');
    });

    it('at the HQ anchor → not pending', async () => {
      const res: any = await service.clockIn('u-1', dto({ latitude: -8.1845, longitude: 113.6687, notes: 'Hadir' }));
      expect(prisma.attendance.upsert.mock.calls[0][0].create.approvalStatus).toBe('none');
      expect(res.approvalStatus).toBe('none');
    });

    it('far from every anchor without alasan → throws', async () => {
      await expect(service.clockIn('u-1', dto())).rejects.toThrow(BadRequestException);
    });

    it('SUPERADMIN can approve pending (matches @Roles guard)', async () => {
      prisma.attendance.findUnique.mockResolvedValue({ id: 'a1', status: 'present', approvalStatus: 'pending' });
      prisma.attendance.update.mockImplementation(async ({ data }: any) => ({ id: 'a1', status: 'present', ...data }));
      const res: any = await service.approveAttendance('a1', 'u-0', ['SUPERADMIN'], 'OK');
      expect(res.approvalStatus).toBe('approved');
    });
  });
});

/**
 * IGDERP-307: late/early math uses WIB wall time (server runs UTC). A
 * 13:58 WIB clock (06:58 UTC) against an 08:00 start previously compared
 * 06:58 < 08:00 and stored isLate=false. Fixed UTC instants make these
 * cases timezone-independent (2026-11-24 is a Tuesday).
 */
describe('AttendanceService IGDERP-307 late in WIB', () => {
  let service: AttendanceService;
  let prisma: any;
  let resolveShift: jest.Mock;
  const pagi = { id: 's-1', name: 'Pagi', clockIn: '08:00', clockOut: '17:00', lateToleranceMin: 15, deletedAt: null };
  const employee = { id: 'emp-1', userId: 'u-1', isActive: true, branchId: 'b-1' };

  beforeEach(async () => {
    resolveShift = jest.fn(async () => ({ shift: pagi, source: 'roster', offDate: false }));
    prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue(employee) },
      branch: { findUnique: jest.fn().mockResolvedValue({ id: 'b-1', operatingHours: null }) },
      attendance: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(async ({ create }: any) => ({ id: 'att-1', ...create })),
        update: jest.fn(async ({ data }: any) => ({ id: 'att-1', ...data })),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        FileTokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: ShiftsService, useValue: { resolveShiftForDate: (...a: any[]) => resolveShift(...a) } },
      ],
    }).compile();
    service = module.get<AttendanceService>(AttendanceService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const clockDto = () => ({ method: 'manual', branch_id: 'b-1' });

  it('wib helpers: 06:58 UTC is 13:58 WIB Tuesday; 08:00 WIB start is 01:00 UTC', () => {
    const at = new Date('2026-11-24T06:58:00.000Z');
    expect(wibParts(at)).toMatchObject({ hh: 13, mm: 58, weekday: 2 });
    expect(wibTimeInstant(at, '08:00').toISOString()).toBe('2026-11-24T01:00:00.000Z');
  });

  it('QA repro: 13:58 WIB vs 08:00 start → isLate, lateMinutes 358', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-24T06:58:00.000Z'));
    const res: any = await service.clockIn('u-1', clockDto());
    const create = prisma.attendance.upsert.mock.calls[0][0].create;
    expect(create.isLate).toBe(true);
    expect(create.lateMinutes).toBe(358);
    expect(res.isLate).toBe(true);
  });

  it('08:10 WIB (within 15m tolerance) → not late, minutes reset', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-24T01:10:00.000Z'));
    const res: any = await service.clockIn('u-1', clockDto());
    expect(prisma.attendance.upsert.mock.calls[0][0].create).toMatchObject({ isLate: false, lateMinutes: 0 });
    expect(res.isLate).toBe(false);
  });

  it('07:50 WIB early arrival → not late', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-24T00:50:00.000Z'));
    await service.clockIn('u-1', clockDto());
    expect(prisma.attendance.upsert.mock.calls[0][0].create).toMatchObject({ isLate: false, lateMinutes: 0 });
  });

  it('roster-libur day → never late, even at 13:58 WIB', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-24T06:58:00.000Z'));
    resolveShift.mockResolvedValue({ shift: null, source: 'roster-libur', offDate: true });
    await service.clockIn('u-1', clockDto());
    expect(prisma.attendance.upsert.mock.calls[0][0].create).toMatchObject({ isLate: false, lateMinutes: 0 });
  });

  it('branch-hours fallback path also uses WIB', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-24T06:58:00.000Z'));
    resolveShift.mockResolvedValue({ shift: null, source: 'none', offDate: false });
    prisma.branch.findUnique.mockResolvedValue({
      id: 'b-1',
      operatingHours: { tuesday: { open: '08:00', close: '17:00' } },
    });
    await service.clockIn('u-1', clockDto());
    expect(prisma.attendance.upsert.mock.calls[0][0].create).toMatchObject({ isLate: true, lateMinutes: 358 });
  });

  it('clockOut 16:00 WIB vs 17:00 close → early leave 60m', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-24T09:00:00.000Z')); // 16:00 WIB Tue
    prisma.attendance.findUnique.mockResolvedValue({
      id: 'att-1',
      employeeId: 'emp-1',
      clockIn: new Date('2026-11-24T01:00:00.000Z'),
      clockOut: null,
      breakTime: null,
      internalNotes: null,
      branch: { operatingHours: { tuesday: { open: '08:00', close: '17:00' } } },
    });
    await service.clockOut('u-1', { method: 'manual', branch_id: 'b-1' } as any);
    expect(prisma.attendance.update.mock.calls[0][0].data).toMatchObject({
      isEarlyLeave: true,
      earlyLeaveMinutes: 60,
    });
  });
});
