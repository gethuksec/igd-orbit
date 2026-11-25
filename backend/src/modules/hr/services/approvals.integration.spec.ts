import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { ApprovalsService } from './approvals.service';

/**
 * IGDERP-275: unified approvals inbox (mocked-Prisma integration).
 */
describe('ApprovalsService inbox (IGDERP-275 integration)', () => {
  let service: ApprovalsService;
  let prisma: any;

  const emp = (id: string) => ({
    id,
    employeeCode: `EMP-${id}`,
    nik: `NIK-${id}`,
    user: { fullName: `Name ${id}` },
  });

  beforeEach(async () => {
    prisma = {
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
              employee: emp('emp-1'),
            },
          ];
          return rows.filter((r) => where.status.in.includes(r.status));
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
              employee: emp('emp-2'),
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

  it('manager (HS) sees pending leave as decidable, step-2 overtime as not', async () => {
    const res = await service.pendingApprovals('u-hs', ['HS'], ['b-1']);
    const leave = res.data.find((i) => i.kind === 'leave');
    const ot = res.data.find((i) => i.kind === 'overtime');
    // HS queries pending leave + pending overtime; our overtime row is manager_approved → not returned for HS
    expect(leave).toBeDefined();
    expect(leave!.canDecide).toBe(true);
    expect(leave!.requester.nik).toBe('NIK-emp-1');
    expect(leave!.decideEndpoint).toContain('/leave/approve');
    expect(prisma.overtimeRequest.findMany.mock.calls[0][0].where.status).toEqual({
      in: ['pending'],
    });
    expect(ot).toBeUndefined();
    expect(res.awaitingDecision).toBe(1);
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
    const res = await service.pendingApprovals('u-staff', ['HS', 'CHR']);
    for (const item of res.data) expect(item.canDecide).toBe(false);
  });

  it('plain staff sees nothing', async () => {
    const res = await service.pendingApprovals('u-staff', ['STAFF']);
    expect(res.total).toBe(0);
    expect(prisma.leaveRequest.findMany).not.toHaveBeenCalled();
  });

  it('leave items carry the request period for inbox cards (IGDERP-313)', async () => {
    const res = await service.pendingApprovals('u-hs', ['HS'], ['b-1']);
    const leave = res.data.find((i) => i.kind === 'leave');
    expect(leave).toBeDefined();
    expect(leave!.startDate).toEqual(new Date('2026-11-29'));
    expect(leave!.endDate).toEqual(new Date('2026-11-30'));
  });
});
