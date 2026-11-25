import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { LeaveService } from './leave.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * IGDERP-314: two-step approval role matrix.
 * Step 1 (pending → manager_approved) is HS/SPV only; step 2 / final
 * (manager_approved → approved + attendance placeholders) is CHR only.
 * The controller @Roles decorators must mirror this matrix — a guard
 * pass followed by a service 403 is the bug this locks in.
 */
describe('LeaveService two-step approval roles (IGDERP-314)', () => {
  let service: LeaveService;
  let prisma: any;

  const pending = (over: any = {}) => ({
    id: 'lr-1',
    employeeId: 'emp-1',
    requestedBy: 'user-se',
    status: 'pending',
    startDate: new Date('2026-11-30T00:00:00Z'), // Monday
    endDate: new Date('2026-12-02T00:00:00Z'), // Wednesday
    employee: { id: 'emp-1', branchId: 'br-1' },
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      leaveRequest: {
        findUnique: jest.fn(),
        update: jest.fn(async ({ data }: any) => ({ id: 'lr-1', ...data })),
      },
      attendance: { upsert: jest.fn(async ({ create }: any) => create) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeaveService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<LeaveService>(LeaveService);
  });

  describe('step 1 — approveLeave', () => {
    it('HS approves pending → manager_approved', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(pending());
      const res: any = await service.approveLeave('lr-1', {}, 'user-hs', ['HS']);
      expect(res.status).toBe('manager_approved');
      expect(prisma.leaveRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'lr-1' } }),
      );
    });

    it('SPV approves pending → manager_approved', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(pending());
      const res: any = await service.approveLeave('lr-1', {}, 'user-spv', ['SPV']);
      expect(res.status).toBe('manager_approved');
    });

    it.each([['CHR'], ['SPV-HRD'], ['SE'], ['HR']])(
      '%s cannot step-1 approve (Forbidden)',
      async (role) => {
        prisma.leaveRequest.findUnique.mockResolvedValue(pending());
        await expect(service.approveLeave('lr-1', {}, 'user-x', [role])).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      },
    );

    it('requester cannot approve their own leave', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(pending());
      await expect(service.approveLeave('lr-1', {}, 'user-se', ['HS'])).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('non-pending request cannot be step-1 approved', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(pending({ status: 'manager_approved' }));
      await expect(service.approveLeave('lr-1', {}, 'user-hs', ['HS'])).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('missing request → NotFound', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(null);
      await expect(service.approveLeave('nope', {}, 'user-hs', ['HS'])).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('step 2 — approveLeaveHr', () => {
    it('CHR finalizes manager_approved → approved + weekday placeholders', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(pending({ status: 'manager_approved' }));
      const res: any = await service.approveLeaveHr('lr-1', 'user-chr', ['CHR']);
      expect(res.status).toBe('approved');
      // Mon–Wed: 3 weekday placeholders with status leave
      expect(prisma.attendance.upsert).toHaveBeenCalledTimes(3);
      expect(prisma.attendance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { status: 'leave' } }),
      );
    });

    it('skips weekend days when creating placeholders', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(
        pending({
          status: 'manager_approved',
          startDate: new Date('2026-12-04T00:00:00Z'), // Friday
          endDate: new Date('2026-12-07T00:00:00Z'), // Monday
        }),
      );
      await service.approveLeaveHr('lr-1', 'user-chr', ['CHR']);
      // Fri + Mon only; Sat/Sun skipped
      expect(prisma.attendance.upsert).toHaveBeenCalledTimes(2);
    });

    it.each([['HS'], ['SPV'], ['SPV-HRD'], ['SE']])(
      '%s cannot finalize (Forbidden)',
      async (role) => {
        prisma.leaveRequest.findUnique.mockResolvedValue(pending({ status: 'manager_approved' }));
        await expect(service.approveLeaveHr('lr-1', 'user-x', [role])).rejects.toBeInstanceOf(
          ForbiddenException,
        );
      },
    );

    it('pending request cannot skip step 1', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(pending());
      await expect(service.approveLeaveHr('lr-1', 'user-chr', ['CHR'])).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.attendance.upsert).not.toHaveBeenCalled();
    });
  });

  describe('rejectLeave', () => {
    it.each([['HS'], ['SPV'], ['CHR']])('%s can reject', async (role) => {
      prisma.leaveRequest.findUnique.mockResolvedValue(pending());
      (service as any).prisma.leaveRequest.update.mockResolvedValue({ id: 'lr-1', status: 'rejected' });
      await expect(
        service.rejectLeave('lr-1', { reason: 'no' } as any, 'user-x', [role]),
      ).resolves.toBeDefined();
    });

    it('SPV-HRD cannot reject (Forbidden)', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue(pending());
      await expect(
        service.rejectLeave('lr-1', { reason: 'no' } as any, 'user-x', ['SPV-HRD']),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
