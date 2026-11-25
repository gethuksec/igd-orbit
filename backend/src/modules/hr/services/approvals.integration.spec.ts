import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { ApprovalsService } from './approvals.service';

/**
 * Unified approvals inbox (mocked-Prisma integration), N+1 revision.
 * Step-1 canDecide = caller holds the requester's parent title in the same
 * branch scope; same-level roles and other lines see but cannot decide.
 */
describe('ApprovalsService inbox (N+1 integration)', () => {
  let service: ApprovalsService;
  let prisma: any;

  // emp-1 (SE, parent AS-SE) requests; emp-2 (CS, parent AS-SRV) requests OT.
  const emp = (id: string, positionId: string, parentPositionId: string | null, branchId: string) => ({
    id,
    branchId,
    employeeCode: `EMP-${id}`,
    nik: `NIK-${id}`,
    user: { fullName: `Name ${id}` },
    position: { id: positionId, parentPositionId },
  });

  const asEmp = (userId: string, positionId: string, branchId: string) => {
    if (userId === 'u-as') return { id: 'emp-as', positionId, branchId };
    if (userId === 'u-hs') return { id: 'emp-hs', positionId: 'p-hs', branchId: 'b-1' };
    if (userId === 'u-as2') return { id: 'emp-as2', positionId: 'p-as', branchId: 'b-2' };
    return null;
  };

  beforeEach(async () => {
    prisma = {
      employee: {
        findUnique: jest.fn(async ({ where }: any) => asEmp(where.userId, 'p-as', 'b-1')),
      },
      userBranch: { findMany: jest.fn(async () => []) },
      leaveRequest: {
        findMany: jest.fn(async ({ where }: any) => {
          const rows = [
            {
              id: 'lr-1',
              status: 'pending',
              createdAt: new Date('2026-11-01'),
              requestedBy: 'u-staff',
              totalDays: 2,
              startDate: new Date('2026-11-29'),
              endDate: new Date('2026-11-30'),
              leaveType: { name: 'Cuti Tahunan' },
              employee: emp('emp-1', 'p-se', 'p-as', 'b-1'),
            },
          ];
          const scope = where.employee?.branchId?.in as string[] | undefined;
          return rows
            .filter((r) => where.status.in.includes(r.status))
            .filter((r) => !scope || scope.includes(r.employee.branchId));
        }),
      },
      overtimeRequest: {
        findMany: jest.fn(async ({ where }: any) => {
          const rows = [
            {
              id: 'ot-1',
              status: 'manager_approved',
              createdAt: new Date('2026-11-02'),
              requestedBy: 'u-staff',
              hours: 3,
              employee: emp('emp-2', 'p-cs', 'p-assrv', 'b-1'),
            },
          ];
          return rows.filter((r) => where.status.in.includes(r.status));
        }),
      },
      shiftSwapRequest: { findMany: jest.fn().mockResolvedValue([]) },
      liburRequest: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApprovalsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ApprovalsService>(ApprovalsService);
  });

  it('direct atasan (AS-SE) sees pending leave as decidable', async () => {
    const res = await service.pendingApprovals('u-as', ['AS-SE'], ['b-1']);
    const leave = res.data.find((i) => i.kind === 'leave');
    expect(leave).toBeDefined();
    expect(leave!.canDecide).toBe(true);
    expect(leave!.requester.nik).toBe('NIK-emp-1');
    expect(leave!.decideEndpoint).toContain('/leave/approve');
    expect(res.awaitingDecision).toBe(1);
  });

  it('HS same branch sees pending leave but cannot decide (wrong line)', async () => {
    const res = await service.pendingApprovals('u-hs', ['HS'], ['b-1']);
    const leave = res.data.find((i) => i.kind === 'leave');
    expect(leave).toBeDefined();
    expect(leave!.canDecide).toBe(false);
    expect(res.awaitingDecision).toBe(0);
  });

  it('atasan from another branch cannot decide (branch scope)', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-as2', positionId: 'p-as', branchId: 'b-2' });
    const res = await service.pendingApprovals('u-as2', ['AS-SE'], ['b-2']);
    const leave = res.data.find((i) => i.kind === 'leave');
    // b-2 scope hides the b-1 row entirely
    expect(leave).toBeUndefined();
    expect(res.awaitingDecision).toBe(0);
  });

  it('CHR sees manager_approved overtime as decidable with step-2 endpoint', async () => {
    const res = await service.pendingApprovals('u-chr', ['CHR']);
    const ot = res.data.find((i) => i.kind === 'overtime');
    expect(ot).toBeDefined();
    expect(ot!.canDecide).toBe(true);
    expect(ot!.decideEndpoint).toContain('approve-hr');
    expect(ot!.summary).toMatch(/Lembur 3 jam/);
  });

  it('requester cannot decide their own item', async () => {
    const res = await service.pendingApprovals('u-staff', ['AS-SE', 'CHR']);
    for (const item of res.data) expect(item.canDecide).toBe(false);
  });

  it('plain staff sees nothing', async () => {
    const res = await service.pendingApprovals('u-staff', ['STAFF']);
    expect(res.total).toBe(0);
    expect(prisma.leaveRequest.findMany).not.toHaveBeenCalled();
  });

  it('leave items carry the request period for inbox cards (IGDERP-313)', async () => {
    const res = await service.pendingApprovals('u-as', ['AS-SE'], ['b-1']);
    const leave = res.data.find((i) => i.kind === 'leave');
    expect(leave).toBeDefined();
    expect(leave!.startDate).toEqual(new Date('2026-11-29'));
    expect(leave!.endDate).toEqual(new Date('2026-11-30'));
  });
});
