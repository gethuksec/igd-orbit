import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { PasswordService } from '../../../shared/services/password.service';
import { outletOnlyWhere } from '../../../shared/utils/outlet-scope';
import { PosService } from '../../pos/pos.service';
import { StockRequestsService } from '../../stock-requests/stock-requests.service';
import { WorkingLocationsService } from '../../working-locations/services/working-locations.service';
import {
  ContractsService,
  resolveTenureAnchor,
} from './contracts.service';

function mockDelegate(extra: any = {}) {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(async () => []),
    count: jest.fn(async () => 0),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    ...extra,
  };
}

/**
 * HR contracts boundary (IGDERP-270): the intake writes Contract +
 * ContractBranch + UserBranch rows in one transaction, the chain reads
 * back ordered, and selling-outlet queries stay outlet-only — the HQ
 * working location never leaks into outlet dropdowns. No DB view.
 */
describe('HR contracts boundary (IGDERP-270 integration)', () => {
  async function boot() {
    const delegates: any = {
      branch: mockDelegate(),
      workingLocation: mockDelegate(),
      contract: mockDelegate(),
      employee: mockDelegate(),
      position: mockDelegate(),
      division: mockDelegate(),
      department: mockDelegate(),
      user: mockDelegate(),
      userBranch: mockDelegate(),
      role: mockDelegate(),
      $transaction: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosService,
        StockRequestsService,
        WorkingLocationsService,
        ContractsService,
        { provide: PrismaService, useValue: delegates },
        {
          provide: PasswordService,
          useValue: {
            validatePasswordStrength: jest.fn(() => ({ isValid: true })),
            hashPassword: jest.fn(async () => 'hashed'),
          },
        },
      ],
    }).compile();
    return {
      pos: module.get(PosService),
      stockRequests: module.get(StockRequestsService),
      locations: module.get(WorkingLocationsService),
      contracts: module.get(ContractsService),
      prisma: delegates,
    };
  }

  it('outlet pickers query branches outlet-only and never touch working locations', async () => {
    const { pos, stockRequests, prisma }: any = await boot();
    prisma.branch.findMany.mockResolvedValue([
      { id: 'b-1', code: 'BR-001', name: 'IGD Jember Pusat' },
    ]);

    await pos.listBranches();
    expect(prisma.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: outletOnlyWhere() }),
    );
    expect(prisma.branch.findMany.mock.calls[0][0].where).toEqual({ isActive: true });

    await stockRequests.listIntakeLinks();
    const lastCall =
      prisma.branch.findMany.mock.calls[prisma.branch.findMany.mock.calls.length - 1][0];
    expect(lastCall.where).toEqual({ isActive: true });

    expect(prisma.workingLocation.findMany).not.toHaveBeenCalled();
    expect(prisma.workingLocation.findFirst).not.toHaveBeenCalled();
  });

  it('intake then chain: one tx, ordered read-back, tenure anchored at chain start', async () => {
    const { contracts, prisma }: any = await boot();
    const tx: any = {
      user: mockDelegate(),
      employee: mockDelegate(),
      contract: mockDelegate(),
      userBranch: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.position.findUnique.mockResolvedValue({
      id: 'pos-1',
      isActive: true,
      defaultRoleId: 'role-1',
      divisionId: null,
    });
    prisma.role.findUnique.mockResolvedValue({ id: 'role-1', isActive: true });
    prisma.branch.findMany.mockResolvedValue([{ id: 'b-1', isActive: true }]);
    prisma.contract.findUnique.mockResolvedValue(null);
    prisma.employee.findFirst.mockResolvedValue(null);
    tx.user.create.mockImplementation(async ({ data }: any) => ({ id: 'u-1', ...data }));
    tx.employee.findUniqueOrThrow.mockImplementation(async () => ({ id: 'emp-1' }));
    tx.contract.create.mockImplementation(async ({ data }: any) => ({ id: 'c-1', ...data }));
    tx.user.findUniqueOrThrow.mockImplementation(async () => ({ id: 'u-1' }));

    await contracts.intake({
      fullName: 'Eka Putri',
      email: 'eka@igdgroup.com',
      password: 'Secret123!',
      type: 'trial',
      startDate: '2026-12-01',
      endDate: '2026-12-31',
      positionId: 'pos-1',
      branchIds: ['b-1'],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.contract.create).toHaveBeenCalledTimes(1);
    expect(tx.userBranch.create).toHaveBeenCalledTimes(1);

    // Chain reads back oldest → newest for the timeline.
    prisma.contract.findMany.mockResolvedValue([
      { id: 'c-1', startDate: new Date('2027-01-01'), endDate: new Date('2027-01-31') },
      { id: 'c-0', startDate: new Date('2026-12-01'), endDate: new Date('2026-12-31') },
    ]);
    const chain: any = await contracts.chainByEmployee('emp-1');
    expect(chain.total).toBe(2);
    const orderBy = prisma.contract.findMany.mock.calls[0][0].orderBy;
    expect(orderBy).toEqual([{ startDate: 'asc' }]);

    const anchor = await resolveTenureAnchor(prisma, 'emp-1', new Date('2026-12-01'));
    expect(anchor?.toISOString()).toBe(new Date('2026-12-01').toISOString());
  });

  it('working locations CRUD independently of branches', async () => {
    const { locations, prisma }: any = await boot();
    prisma.workingLocation.findUnique.mockResolvedValue(null);
    prisma.workingLocation.create.mockImplementation(async ({ data }: any) => ({ id: 'wl-1', ...data }));
    const created: any = await locations.create({ code: 'HQ-JBR', name: 'HQ Jember' });
    expect(created.code).toBe('HQ-JBR');
    expect(prisma.branch.create).not.toHaveBeenCalled();
    expect(prisma.branch.update).not.toHaveBeenCalled();
  });
});
