import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { ShiftsService } from '../../shifts/shifts.service';
import { AttendanceService, mobileClockOutside } from './attendance.service';
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
