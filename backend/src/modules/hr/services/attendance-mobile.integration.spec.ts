import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { AttendanceService } from './attendance.service';
import { ShiftsService } from '../../shifts/shifts.service';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

/**
 * IGDERP-275: mobile clock in/out + selfie upload + overtime 2-step
 * (mocked-Prisma integration, repo convention).
 */
describe('AttendanceService mobile + overtime 2-step (IGDERP-275 integration)', () => {
  let service: AttendanceService;
  let prisma: any;

  const branch = {
    id: 'b-1',
    name: 'Pusat',
    latitude: -7.25,
    longitude: 112.75,
    attendanceRadiusM: 100,
    operatingHours: null,
  };
  const employee = { id: 'emp-1', userId: 'u-1', isActive: true, branchId: 'b-1' };
  const dto = (over: any = {}) => ({
    method: 'mobile',
    branch_id: 'b-1',
    latitude: -7.25,
    longitude: 112.75,
    photoUrl: '/uploads/attendance-selfies/selfie-u-1.jpg',
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue(employee) },
      branch: { findUnique: jest.fn().mockResolvedValue(branch) },
      attendance: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(async ({ create }: any) => ({ id: 'att-1', ...create })),
        update: jest.fn(async ({ data }: any) => ({ id: 'att-1', ...data })),
      },
      overtimeRequest: {
        findUnique: jest.fn(),
        update: jest.fn(async ({ data }: any) => ({ id: 'ot-1', ...data })),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: ShiftsService, useValue: { resolveShiftForDate: jest.fn().mockResolvedValue(null) } },
      ],
    }).compile();
    service = module.get<AttendanceService>(AttendanceService);
  });

  it('mobile clock-in persists selfie + GPS inside radius', async () => {
    const res: any = await service.clockIn('u-1', dto());
    expect(prisma.attendance.upsert).toHaveBeenCalled();
    const payload = prisma.attendance.upsert.mock.calls[0][0];
    expect(payload.create.clockInPhotoUrl).toBe('/uploads/attendance-selfies/selfie-u-1.jpg');
    expect(Number(payload.create.clockInLat)).toBeCloseTo(-7.25, 5);
    expect(res.clockInMethod).toBe('mobile');
  });

  it('mobile clock-in rejects missing selfie', async () => {
    await expect(service.clockIn('u-1', dto({ photoUrl: undefined }))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('mobile clock-in outside radius needs alasan, then records pending', async () => {
    await expect(
      service.clockIn('u-1', dto({ latitude: -7.24 })),
    ).rejects.toThrow(/Alasan wajib/);
    const res: any = await service.clockIn('u-1', dto({ latitude: -7.24, notes: 'Macet parah' }));
    const payload = prisma.attendance.upsert.mock.calls[0][0];
    expect(payload.create.approvalStatus).toBe('pending');
    expect(res.approvalStatus).toBe('pending');
  });

  it('non-mobile clock-in needs no GPS/photo (back-compat)', async () => {
    const res: any = await service.clockIn('u-1', {
      method: 'manual',
      branch_id: 'b-1',
    } as any);
    expect(res.clockInMethod).toBe('manual');
  });

  it('mobile clock-out persists selfie + GPS', async () => {
    prisma.attendance.findUnique.mockResolvedValue({
      id: 'att-1',
      clockIn: new Date(Date.now() - 8 * 3600 * 1000),
      clockOut: null,
      branch,
      breakTime: null,
      internalNotes: null,
    });
    const res: any = await service.clockOut('u-1', {
      method: 'mobile',
      latitude: -7.25,
      longitude: 112.75,
      photoUrl: '/uploads/attendance-selfies/selfie-u-1-out.jpg',
    } as any);
    const payload = prisma.attendance.update.mock.calls[0][0];
    expect(payload.data.clockOutPhotoUrl).toBe('/uploads/attendance-selfies/selfie-u-1-out.jpg');
    expect(res.clockOutMethod).toBe('mobile');
  });

  it('uploadSelfie rejects non-image and oversize', async () => {
    await expect(service.uploadSelfie(undefined, 'u-1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.uploadSelfie({ originalname: 'a.pdf', mimetype: 'application/pdf', size: 10, buffer: Buffer.from('x') }, 'u-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.uploadSelfie(
        { originalname: 'a.jpg', mimetype: 'image/jpeg', size: 3 * 1024 * 1024, buffer: Buffer.alloc(10) },
        'u-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('overtime: step 1 (HS) → manager_approved, step 2 (CHR) → approved + stamps attendance', async () => {
    prisma.overtimeRequest.findUnique.mockResolvedValue({
      id: 'ot-1',
      status: 'pending',
      requestedBy: 'u-staff',
      hours: 2,
      attendance: { id: 'att-1' },
    });
    const s1: any = await service.approveOvertime('ot-1', 'u-hs', ['HS']);
    expect(s1.status).toBe('manager_approved');
    expect(s1.managerApprovedBy).toBe('u-hs');

    prisma.overtimeRequest.findUnique.mockResolvedValue({
      id: 'ot-1',
      status: 'manager_approved',
      requestedBy: 'u-staff',
      hours: 2,
      attendance: { id: 'att-1' },
    });
    const s2: any = await service.approveOvertimeHr('ot-1', 'u-chr', ['CHR']);
    expect(s2.status).toBe('approved');
    expect(prisma.attendance.update).toHaveBeenCalled();
  });

  it('overtime: CHR cannot skip step 1; requester cannot self-approve step 1', async () => {
    prisma.overtimeRequest.findUnique.mockResolvedValue({
      id: 'ot-1',
      status: 'pending',
      requestedBy: 'u-hs',
      attendance: null,
    });
    await expect(service.approveOvertimeHr('ot-1', 'u-chr', ['CHR'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.approveOvertime('ot-1', 'u-hs', ['HS'])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('overtime: step 1 requires HS/SPV role', async () => {
    await expect(service.approveOvertime('ot-1', 'u-x', ['STAFF'])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejectOvertime: HS rejects pending, CHR rejects manager_approved, HS cannot reject manager_approved', async () => {
    prisma.overtimeRequest.findUnique.mockResolvedValue({ id: 'ot-1', status: 'pending' });
    const r1: any = await service.rejectOvertime('ot-1', 'x', 'u-hs', ['HS']);
    expect(r1.status).toBe('rejected');

    prisma.overtimeRequest.findUnique.mockResolvedValue({ id: 'ot-1', status: 'manager_approved' });
    const r2: any = await service.rejectOvertime('ot-1', 'x', 'u-chr', ['CHR']);
    expect(r2.status).toBe('rejected');

    prisma.overtimeRequest.findUnique.mockResolvedValue({ id: 'ot-1', status: 'manager_approved' });
    await expect(service.rejectOvertime('ot-1', 'x', 'u-hs', ['HS'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('clock-in still 404s unknown employee', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);
    await expect(service.clockIn('u-x', dto())).rejects.toBeInstanceOf(NotFoundException);
  });
});
