import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { LeaveService } from './leave.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * Leave 2-step approval (mocked-Prisma integration), N+1 revision.
 * pending → (direct atasan N+1) → manager_approved → (CHR) → approved.
 * Same-level roles and higher ranks in other lines cannot decide step 1.
 */
describe('LeaveService 2-step approval (N+1 integration)', () => {
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

  // Requester emp-1 sits on SE (parent AS-SE, branch b-1).
  // u-as holds AS-SE in b-1 → the only step-1 decider.
  const wireN1 = (callerUserId: 'u-as' | 'u-hs' | 'u-chr' | 'u-staff' | 'u-owner' = 'u-as') => {
    prisma.employee.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === 'emp-1') {
        return {
          id: 'emp-1',
          branchId: 'b-1',
          positionId: 'p-se',
          position: { id: 'p-se', parentPositionId: 'p-as' },
        };
      }
      if (where.userId === 'u-as') {
        return { id: 'emp-as', positionId: 'p-as', branchId: 'b-1', isActive: true };
      }
      if (where.userId === 'u-hs') {
        return { id: 'emp-hs', positionId: 'p-hs', branchId: 'b-1', isActive: true };
      }
      return null;
    });
    prisma.userBranch.findMany.mockResolvedValue([]);
    return callerUserId;
  };

  const n1Roles = (u: string) =>
    u === 'u-as' ? ['AS-SE'] : u === 'u-hs' ? ['HS'] : u === 'u-chr' ? ['CHR'] : u === 'u-owner' ? ['OWNER'] : ['SE'];

  beforeEach(async () => {
    prisma = {
      leaveRequest: {
        findUnique: jest.fn(),
        update: jest.fn(async ({ data }: any) => ({ id: 'lr-1', ...data })),
      },
      attendance: { upsert: jest.fn() },
      employee: { findUnique: jest.fn() },
      userBranch: { findMany: jest.fn(async () => []) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeaveService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<LeaveService>(LeaveService);
  });

  it('step 1 (direct atasan AS-SE) moves pending → manager_approved', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(row('pending'));
    wireN1('u-as');
    const res: any = await service.approveLeave('lr-1', {} as any, 'u-as', n1Roles('u-as'));
    expect(res.status).toBe('manager_approved');
    expect(res.managerApprovedBy).toBe('u-as');
    expect(prisma.attendance.upsert).not.toHaveBeenCalled();
  });

  it('step 1 rejects HS (same branch, higher rank, wrong line)', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(row('pending'));
    wireN1('u-hs');
    await expect(service.approveLeave('lr-1', {} as any, 'u-hs', n1Roles('u-hs'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('step 1 rejects CHR (wrong step)', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(row('pending'));
    wireN1('u-chr');
    await expect(service.approveLeave('lr-1', {} as any, 'u-chr', n1Roles('u-chr'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('step 1 allows OWNER bypass (emergency)', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(row('pending'));
    wireN1('u-owner');
    const res: any = await service.approveLeave('lr-1', {} as any, 'u-owner', n1Roles('u-owner'));
    expect(res.status).toBe('manager_approved');
  });

  it('step 1 rejects self-approval by requester', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(row('pending', 'u-staff'));
    wireN1('u-staff');
    await expect(service.approveLeave('lr-1', {} as any, 'u-staff', n1Roles('u-staff'))).rejects.toBeInstanceOf(
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

  it('reject: atasan rejects pending, CHR rejects manager_approved, HS rejected at both', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(row('pending'));
    wireN1('u-as');
    const r1: any = await service.rejectLeave('lr-1', { reason: 'x' } as any, 'u-as', n1Roles('u-as'));
    expect(r1.status).toBe('rejected');

    prisma.leaveRequest.findUnique.mockResolvedValue(row('manager_approved'));
    const r2: any = await service.rejectLeave('lr-1', { reason: 'x' } as any, 'u-chr', ['CHR']);
    expect(r2.status).toBe('rejected');

    prisma.leaveRequest.findUnique.mockResolvedValue(row('pending'));
    wireN1('u-hs');
    await expect(
      service.rejectLeave('lr-1', { reason: 'x' } as any, 'u-hs', n1Roles('u-hs')),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.leaveRequest.findUnique.mockResolvedValue(row('manager_approved'));
    await expect(
      service.rejectLeave('lr-1', { reason: 'x' } as any, 'u-as', n1Roles('u-as')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s unknown request', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(null);
    await expect(service.approveLeave('nope', {} as any, 'u-as', ['AS-SE'])).rejects.toBeInstanceOf(
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
