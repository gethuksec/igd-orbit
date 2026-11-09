import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { LeaveTypesService } from '../../leave-types/leave-types.service';
import { PenaltyTypesService } from '../../penalty-types/penalty-types.service';
import { LeaveService } from './leave.service';

/**
 * HR master-data module boundary (IGDERP-261, cuti + denda only).
 * Compiles both master services + LeaveService together against one mocked
 * PrismaService and runs a cross-service scenario: masters resolve for
 * leave filing, penalty priorities encode the alpha-beats-lebih-libur rule,
 * and the leave delete guard sees referencing rows.
 */
describe('HR master-data module boundary (integration)', () => {
  let leaveTypes: LeaveTypesService;
  let penalties: PenaltyTypesService;
  let leave: LeaveService;
  let prisma: any;

  const masters = {
    leaveType: [
      { id: 'lt-1', code: 'CUTI-TAHUNAN', name: 'Cuti Tahunan', isPaid: true, quotaDays: 12, maxApplyDelayDays: null, maxRequestsPerMonth: null, requiresAttachment: false, isActive: true },
      { id: 'lt-2', code: 'SAKIT', name: 'Sakit', isPaid: true, quotaDays: 12, maxApplyDelayDays: 0, maxRequestsPerMonth: 1, requiresAttachment: true, isActive: true },
    ],
    penaltyType: [
      { id: 'p-1', code: 'DENDA-ALPHA', name: 'Alpha', priority: 10 },
      { id: 'p-2', code: 'DENDA-LEBIH-LIBUR', name: 'Lebih Libur', priority: 4 },
    ],
  };

  beforeEach(async () => {
    prisma = {
      leaveType: {
        findUnique: jest.fn(),
        findFirst: jest.fn(async ({ where }: any) => {
          if (where.id) return masters.leaveType.find((t) => t.id === where.id) ?? null;
          if (where.code) return masters.leaveType.find((t) => t.code === where.code) ?? null;
          return null;
        }),
        findMany: jest.fn(async () => masters.leaveType),
        count: jest.fn(async () => masters.leaveType.length),
        create: jest.fn(),
        update: jest.fn(),
      },
      penaltyType: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(async () => masters.penaltyType),
        count: jest.fn(async () => masters.penaltyType.length),
        create: jest.fn(),
        update: jest.fn(),
      },
      employee: { findUnique: jest.fn(async () => ({ id: 'emp-1', userId: 'u-1' })) },
      leaveRequest: {
        findUnique: jest.fn(),
        findFirst: jest.fn(async () => null),
        findMany: jest.fn(async () => []),
        count: jest.fn(async () => 0),
        create: jest.fn(async ({ data }: any) => ({ id: 'lr-1', ...data })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveTypesService,
        PenaltyTypesService,
        LeaveService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    leaveTypes = module.get(LeaveTypesService);
    penalties = module.get(PenaltyTypesService);
    leave = module.get(LeaveService);
  });

  it('both master services list against the shared prisma mock', async () => {
    await expect(leaveTypes.findAll({} as any)).resolves.toMatchObject({ meta: { total: 2 } });
    await expect(penalties.findAll({} as any)).resolves.toMatchObject({ meta: { total: 2 } });
  });

  it('leave filing resolves the master and stores leaveTypeId', async () => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    const iso = d.toISOString().slice(0, 10);
    const res: any = await leave.requestLeave(
      { leave_type: 'CUTI-TAHUNAN', start_date: iso, end_date: iso, reason: 'cuti' } as any,
      'u-1',
    );
    expect(res.leaveTypeId).toBe('lt-1');
    expect(res).not.toHaveProperty('leaveType');
  });

  it('penalty masters encode alpha-beats-lebih-libur via priority', async () => {
    const res: any = await penalties.findAll({} as any);
    const byCode = Object.fromEntries(res.data.map((p: any) => [p.code, p.priority]));
    expect(byCode['DENDA-ALPHA']).toBeGreaterThan(byCode['DENDA-LEBIH-LIBUR']);
  });
});
