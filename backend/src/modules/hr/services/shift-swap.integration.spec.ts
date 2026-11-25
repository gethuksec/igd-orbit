import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { ShiftSwapService } from './shift-swap.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

/**
 * IGDERP-275: shift swap request + 2-step approval (mocked-Prisma integration).
 */
describe('ShiftSwapService (IGDERP-275 integration)', () => {
  let service: ShiftSwapService;
  let prisma: any;

  const future = new Date();
  future.setDate(future.getDate() + 7);
  const dateStr = future.toISOString().slice(0, 10);

  beforeEach(async () => {
    prisma = {
      employee: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.userId === 'u-1' || where.id === 'emp-1') {
            return {
              id: 'emp-1',
              userId: 'u-1',
              isActive: true,
              branchId: 'b-1',
              positionId: 'p-se',
              position: { id: 'p-se', parentPositionId: 'p-as' },
            };
          }
          if (where.userId === 'u-as') {
            return { id: 'emp-as', userId: 'u-as', isActive: true, branchId: 'b-1', positionId: 'p-as' };
          }
          if (where.userId === 'u-hs') {
            return { id: 'emp-hs', userId: 'u-hs', isActive: true, branchId: 'b-1', positionId: 'p-hs' };
          }
          return where.id === 'emp-2'
            ? { id: 'emp-2', userId: 'u-2', isActive: true }
            : null;
        }),
      },
      userBranch: { findMany: jest.fn(async () => []) },
      shift: {
        findUnique: jest.fn(async ({ where }: any) =>
          where.id === 's-pagi'
            ? { id: 's-pagi', isActive: true, deletedAt: null }
            : where.id === 's-sore'
              ? { id: 's-sore', isActive: true, deletedAt: null }
              : null,
        ),
      },
      shiftSwapRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(async ({ data }: any) => ({ id: 'sw-1', ...data })),
        update: jest.fn(async ({ data }: any) => ({ id: 'sw-1', ...data })),
      },
      shiftAssignment: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShiftSwapService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ShiftSwapService>(ShiftSwapService);
  });

  const dto = () => ({
    target_employee_id: 'emp-2',
    date: dateStr,
    from_shift_id: 's-pagi',
    to_shift_id: 's-sore',
  });

  it('files a valid swap request', async () => {
    const res: any = await service.requestSwap(dto() as any, 'u-1');
    expect(res.status).toBe('pending');
    expect(res.employeeId).toBe('emp-1');
  });

  it('rejects self-swap and same-shift swap', async () => {
    await expect(
      service.requestSwap({ ...dto(), target_employee_id: 'emp-1' } as any, 'u-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.requestSwap({ ...dto(), to_shift_id: 's-pagi' } as any, 'u-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown target and duplicate pending swap', async () => {
    await expect(
      service.requestSwap({ ...dto(), target_employee_id: 'emp-x' } as any, 'u-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.shiftSwapRequest.findFirst.mockResolvedValue({ id: 'sw-old' });
    await expect(service.requestSwap(dto() as any, 'u-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('step 1 (direct atasan) → manager_approved, step 2 → approved', async () => {
    prisma.shiftSwapRequest.findUnique.mockResolvedValue({
      id: 'sw-1',
      status: 'pending',
      requestedBy: 'u-1',
      employeeId: 'emp-1',
    });
    const s1: any = await service.approve('sw-1', 'u-as', ['AS-SE']);
    expect(s1.status).toBe('manager_approved');

    prisma.shiftSwapRequest.findUnique.mockResolvedValue({
      id: 'sw-1',
      status: 'manager_approved',
      requestedBy: 'u-1',
      employeeId: 'emp-1',
      targetEmployeeId: 'emp-2',
      date: future,
      fromShiftId: 's-pagi',
      toShiftId: 's-sore',
    });
    const s2: any = await service.approveHr('sw-1', 'u-chr', ['CHR']);
    expect(s2.status).toBe('approved');
  });

  it('step 2 without step 1 fails; wrong line fails step 1', async () => {
    prisma.shiftSwapRequest.findUnique.mockResolvedValue({
      id: 'sw-1',
      status: 'pending',
      requestedBy: 'u-1',
      employeeId: 'emp-1',
    });
    await expect(service.approveHr('sw-1', 'u-chr', ['CHR'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.approve('sw-1', 'u-x', ['STAFF'])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.approve('sw-1', 'u-hs', ['HS'])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('requester can cancel undecided swap; others cannot', async () => {
    prisma.shiftSwapRequest.findUnique.mockResolvedValue({
      id: 'sw-1',
      status: 'pending',
      requestedBy: 'u-1',
    });
    const res: any = await service.cancel('sw-1', 'u-1');
    expect(res.status).toBe('cancelled');
    await expect(service.cancel('sw-1', 'u-2')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
