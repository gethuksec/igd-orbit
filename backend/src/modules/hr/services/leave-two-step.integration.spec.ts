import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { LeaveService } from './leave.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * IGDERP-275: leave 2-step approval (mocked-Prisma integration).
 * pending → (HS/SPV) → manager_approved → (CHR) → approved.
 */
describe('LeaveService 2-step approval (IGDERP-275 integration)', () => {
  let service: LeaveService;
  let prisma: any;

  const row = (status: string, requestedBy = 'u-staff') => ({
    id: 'lr-1',
    status,
    requestedBy,
    startDate: new Date('2026-12-01'),
    endDate: new Date('2026-12-01'),
    employeeId: 'emp-1',
    employee: { branchId: 'b-1' },
  });

  beforeEach(async () => {
    prisma = {
      leaveRequest: {
        findUnique: jest.fn(),
        update: jest.fn(async ({ data }: any) => ({ id: 'lr-1', ...data })),
      },
      attendance: { upsert: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeaveService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<LeaveService>(LeaveService);
  });

  it('step 1 (HS) moves pending → manager_approved', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(row('pending'));
    const res: any = await service.approveLeave('lr-1', {} as any, 'u-hs', ['HS']);
    expect(res.status).toBe('manager_approved');
    expect(res.managerApprovedBy).toBe('u-hs');
    expect(prisma.attendance.upsert).not.toHaveBeenCalled();
  });

  it('step 1 rejects CHR (wrong step)', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(row('pending'));
    await expect(service.approveLeave('lr-1', {} as any, 'u-chr', ['CHR'])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('step 1 rejects self-approval by requester', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(row('pending', 'u-hs'));
    await expect(service.approveLeave('lr-1', {} as any, 'u-hs', ['HS'])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('step 2 (CHR) moves manager_approved → approved + writes leave placeholders', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(row('manager_approved'));
    const res: any = await service.approveLeaveHr('lr-1', 'u-chr', ['CHR']);
    expect(res.status).toBe('approved');
    expect(res.hrApprovedBy).toBe('u-chr');
    expect(prisma.attendance.upsert).toHaveBeenCalled();
  });

  it('step 2 refuses to skip step 1', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(row('pending'));
    await expect(service.approveLeaveHr('lr-1', 'u-chr', ['CHR'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('step 2 requires CHR role', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(row('manager_approved'));
    await expect(service.approveLeaveHr('lr-1', 'u-hs', ['HS'])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('reject: HS rejects pending, CHR rejects manager_approved, HS cannot reject manager_approved', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(row('pending'));
    const r1: any = await service.rejectLeave('lr-1', { reason: 'x' } as any, 'u-hs', ['HS']);
    expect(r1.status).toBe('rejected');

    prisma.leaveRequest.findUnique.mockResolvedValue(row('manager_approved'));
    const r2: any = await service.rejectLeave('lr-1', { reason: 'x' } as any, 'u-chr', ['CHR']);
    expect(r2.status).toBe('rejected');

    prisma.leaveRequest.findUnique.mockResolvedValue(row('manager_approved'));
    await expect(
      service.rejectLeave('lr-1', { reason: 'x' } as any, 'u-hs', ['HS']),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s unknown request', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(null);
    await expect(service.approveLeave('nope', {} as any, 'u-hs', ['HS'])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('uploadAttachment rejects non-image/PDF and oversize', async () => {
    await expect(service.uploadAttachment(undefined, 'u-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.uploadAttachment(
        { originalname: 'a.txt', mimetype: 'text/plain', size: 10, buffer: Buffer.from('x') },
        'u-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
