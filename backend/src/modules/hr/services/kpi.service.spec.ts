import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import {
  KPIService,
  nilaiFromTotal,
  aspectSkor,
} from './kpi.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

function mockDelegate() {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  };
}

const NOW = new Date();
const CM = NOW.getMonth() + 1;
const CY = NOW.getFullYear();
const PM = CM === 1 ? 12 : CM - 1;
const PY = CM === 1 ? CY - 1 : CY;

const ASPECTS = [
  { id: 'a-kol', divisionId: 'div-srv', code: 'HP_DONE', targetType: 'PERIOD', fixedTarget: null, weight: 0.2, isKolektif: true, intervalMin: 60, intervalMax: 140, isActive: true },
  { id: 'a-kua', divisionId: 'div-srv', code: 'KUALITAS', targetType: 'FIXED', fixedTarget: 100, weight: 0.3, isKolektif: false, intervalMin: 60, intervalMax: 140, isActive: true },
  { id: 'a-tim', divisionId: 'div-srv', code: 'TEAMWORK', targetType: 'FIXED', fixedTarget: 100, weight: 0.5, isKolektif: false, intervalMin: 60, intervalMax: 140, isActive: true },
];

const SUPER = ['SUPERADMIN'];

async function boot(overrides: Record<string, any> = {}) {
  const delegates: Record<string, any> = {
    division: mockDelegate(),
    kpiDivisionConfig: mockDelegate(),
    kpiAspect: mockDelegate(),
    kpiPeriodTarget: mockDelegate(),
    kpiPeriodActual: mockDelegate(),
    kpiScore: mockDelegate(),
    kpiEmployeeNote: mockDelegate(),
    kpiPeriodLock: mockDelegate(),
    employee: mockDelegate(),
    contract: mockDelegate(),
    ...overrides,
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [KPIService, { provide: PrismaService, useValue: delegates }],
  }).compile();
  return { service: module.get(KPIService), prisma: delegates as any };
}

describe('KPI math (IGDERP-266, sheet Kpi!T ladder)', () => {
  it.each([
    [0.5, 0.6],
    [0.75, 0.6],
    [0.76, 0.7],
    [0.8, 0.7],
    [0.85, 0.8],
    [0.95, 0.9],
    [1.0, 1.0],
    [1.009, 1.1], // sheet example: 100.9% -> 1.1
    [1.15, 1.1],
    [1.25, 1.2],
    [1.3, 1.3],
    [1.4, 1.4],
    [1.5, 1.2], // over-range falls back to 1.2 per sheet formula
  ])('nilaiFromTotal(%s) = %s', (total, expected) => {
    expect(nilaiFromTotal(total)).toBe(expected);
  });

  it('aspectSkor mirrors (capaian/target)*weight', () => {
    expect(aspectSkor(130, 100, 0.3)).toBeCloseTo(0.39, 9);
    expect(aspectSkor(0, 0, 0.2)).toBe(0);
  });
});

describe('KPIService aspects/config validation', () => {
  it('rejects aspect creation for unknown division', async () => {
    const { service, prisma }: any = await boot();
    prisma.division.findUnique.mockResolvedValue(null);
    await expect(
      service.createAspect('nope', { code: 'X', name: 'X', weight: 0.2, target_type: 'FIXED', fixed_target: 100 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects FIXED aspect without fixed_target', async () => {
    const { service, prisma }: any = await boot();
    prisma.division.findUnique.mockResolvedValue({ id: 'd' });
    await expect(
      service.createAspect('d', { code: 'X', name: 'X', weight: 0.2, target_type: 'FIXED' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate aspect code per division', async () => {
    const { service, prisma }: any = await boot();
    prisma.division.findUnique.mockResolvedValue({ id: 'd' });
    prisma.kpiAspect.findUnique.mockResolvedValue({ id: 'dup' });
    await expect(
      service.createAspect('d', { code: 'X', name: 'X', weight: 0.2, target_type: 'FIXED', fixed_target: 100 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects weight outside (0,1]', async () => {
    const { service, prisma }: any = await boot();
    prisma.division.findUnique.mockResolvedValue({ id: 'd' });
    await expect(
      service.createAspect('d', { code: 'X', name: 'X', weight: 1.5, target_type: 'FIXED', fixed_target: 100 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects negative default_amount', async () => {
    const { service, prisma }: any = await boot();
    prisma.division.findUnique.mockResolvedValue({ id: 'd' });
    await expect(service.upsertConfig('d', { default_amount: -1 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects update of missing aspect', async () => {
    const { service, prisma }: any = await boot();
    prisma.kpiAspect.findUnique.mockResolvedValue(null);
    await expect(service.updateAspect('nope', { name: 'X' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects out-of-scope aspect writes', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: 'e-spv', userId: 'u-spv', divisionId: 'div-other' });
    await expect(
      service.createAspect(
        'div-srv',
        { code: 'X', name: 'X', weight: 0.2, target_type: 'FIXED', fixed_target: 100 },
        { userId: 'u-spv', roles: ['SPV'] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('KPIService scoping (IGDERP-266 rework)', () => {
  it('super roles see all divisions (null scope)', async () => {
    const { service }: any = await boot();
    await expect(service.scopeDivisionIds('u1', SUPER)).resolves.toBeNull();
  });

  it('superiors resolve to their own division', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: 'e1', userId: 'u-spv', divisionId: 'div-srv' });
    await expect(service.scopeDivisionIds('u-spv', ['SPV'])).resolves.toEqual(['div-srv']);
  });

  it('accounts without an employee record have no scope', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue(null);
    await expect(service.scopeDivisionIds('u-x', ['SPV'])).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listDivisions is scoped for superiors', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: 'e1', userId: 'u-spv', divisionId: 'div-srv' });
    prisma.division.findMany.mockResolvedValue([{ id: 'div-srv', code: 'DIV-OPS-SRV', name: 'Service' }]);
    prisma.kpiPeriodLock.findUnique.mockResolvedValue(null);
    prisma.employee.count.mockResolvedValue(6);
    const rows: any = await service.listDivisions('u-spv', ['SPV']);
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('unassigned');
    expect(prisma.division.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['div-srv'] } } }),
    );
  });

  it('listDivisions maps shell rows to assigned/approved', async () => {
    const { service, prisma }: any = await boot();
    prisma.division.findMany.mockResolvedValue([
      { id: 'a', code: 'A', name: 'A' },
      { id: 'b', code: 'B', name: 'B' },
    ]);
    prisma.kpiPeriodLock.findUnique
      .mockResolvedValueOnce({ status: 'assigned' })
      .mockResolvedValueOnce({ status: 'approved' });
    prisma.employee.count.mockResolvedValue(3);
    const rows: any = await service.listDivisions('u1', SUPER);
    expect(rows.map((r: any) => r.status)).toEqual(['assigned', 'approved']);
  });
});

describe('KPIService grid guards (assign/edit flow)', () => {
  function shell(status: string | null) {
    return { kpiPeriodLock: { ...mockDelegate(), findUnique: jest.fn().mockResolvedValue(status ? { status } : null) } };
  }

  it('refuses writes to an approved period', async () => {
    const { service }: any = await boot(shell('approved'));
    await expect(
      service.saveGrid('div-srv', { period_month: CM, period_year: CY, scores: [] }, 'u1', SUPER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses writes to legacy locked rows', async () => {
    const { service }: any = await boot(shell('locked'));
    await expect(
      service.saveGrid('div-srv', { period_month: CM, period_year: CY, scores: [] }, 'u1', SUPER),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses writes when the period was never assigned', async () => {
    const { service }: any = await boot(shell(null));
    await expect(
      service.saveGrid('div-srv', { period_month: CM, period_year: CY, scores: [] }, 'u1', SUPER),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses writes outside the current month', async () => {
    const { service }: any = await boot(shell('assigned'));
    await expect(
      service.saveGrid('div-srv', { period_month: PM, period_year: PY, scores: [] }, 'u1', SUPER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects individual scores outside the aspect interval', async () => {
    const { service }: any = await boot({
      ...shell('assigned'),
      kpiAspect: { ...mockDelegate(), findMany: jest.fn().mockResolvedValue(ASPECTS) },
    });
    await expect(
      service.saveGrid(
        'div-srv',
        { period_month: CM, period_year: CY, scores: [{ employeeId: 'e1', aspectId: 'a-kua', value: 55 }] },
        'u1',
        SUPER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects kolektif aspects scored per employee and vice versa', async () => {
    const { service }: any = await boot({
      ...shell('assigned'),
      kpiAspect: { ...mockDelegate(), findMany: jest.fn().mockResolvedValue(ASPECTS) },
      employee: { ...mockDelegate(), findUnique: jest.fn().mockResolvedValue({ id: 'e1', divisionId: 'div-srv' }) },
    });
    await expect(
      service.saveGrid(
        'div-srv',
        { period_month: CM, period_year: CY, scores: [{ employeeId: 'e1', aspectId: 'a-kol', value: 100 }] },
        'u1',
        SUPER,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.saveGrid('div-srv', { period_month: CM, period_year: CY, kolektif: [{ aspectId: 'a-kua', value: 100 }] }, 'u1', SUPER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects aspects from another division', async () => {
    const { service }: any = await boot({
      ...shell('assigned'),
      kpiAspect: { ...mockDelegate(), findMany: jest.fn().mockResolvedValue(ASPECTS) },
    });
    await expect(
      service.saveGrid('div-srv', { period_month: CM, period_year: CY, targets: [{ aspectId: 'other', target: 5 }] }, 'u1', SUPER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('KPIService assign-once', () => {
  function assignStubs(weightsOk = true) {
    const aspects = weightsOk ? ASPECTS : ASPECTS.map((a) => ({ ...a, weight: 0.1 }));
    return {
      division: { ...mockDelegate(), findUnique: jest.fn().mockResolvedValue({ id: 'div-srv' }) },
      kpiAspect: { ...mockDelegate(), findMany: jest.fn().mockResolvedValue(aspects) },
      kpiPeriodTarget: { ...mockDelegate(), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      kpiPeriodActual: { ...mockDelegate(), findMany: jest.fn().mockResolvedValue([]) },
      kpiDivisionConfig: { ...mockDelegate(), findUnique: jest.fn().mockResolvedValue({ defaultAmount: 700000 }) },
    };
  }

  it('assigns once: creates the shell and writes the grid', async () => {
    const { service, prisma }: any = await boot({
      ...assignStubs(),
      kpiPeriodLock: {
        ...mockDelegate(),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ status: 'assigned' }),
      },
      kpiScore: { ...mockDelegate(), findMany: jest.fn().mockResolvedValue([]) },
      kpiEmployeeNote: { ...mockDelegate(), findMany: jest.fn().mockResolvedValue([]) },
      employee: { ...mockDelegate(), findMany: jest.fn().mockResolvedValue([]) },
      contract: { ...mockDelegate(), findMany: jest.fn().mockResolvedValue([]) },
    });
    prisma.division.findUnique.mockResolvedValue({ id: 'div-srv' });
    await service.assignPeriod('div-srv', { period_month: CM, period_year: CY, scores: [] }, 'u1', SUPER);
    expect(prisma.kpiPeriodLock.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'assigned' }) }),
    );
  });

  it('refuses a second assign for the same period', async () => {
    const { service, prisma }: any = await boot({
      ...assignStubs(),
      kpiPeriodLock: { ...mockDelegate(), findUnique: jest.fn().mockResolvedValue({ status: 'assigned' }) },
    });
    prisma.division.findUnique.mockResolvedValue({ id: 'div-srv' });
    await expect(
      service.assignPeriod('div-srv', { period_month: CM, period_year: CY, scores: [] }, 'u1', SUPER),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses assign when weights do not sum to 1.0', async () => {
    const { service, prisma }: any = await boot({
      ...assignStubs(false),
      kpiPeriodLock: { ...mockDelegate(), findUnique: jest.fn().mockResolvedValue(null) },
    });
    prisma.division.findUnique.mockResolvedValue({ id: 'div-srv' });
    await expect(
      service.assignPeriod('div-srv', { period_month: CM, period_year: CY, scores: [] }, 'u1', SUPER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses assign outside the current month', async () => {
    const { service, prisma }: any = await boot(assignStubs());
    prisma.division.findUnique.mockResolvedValue({ id: 'div-srv' });
    await expect(
      service.assignPeriod('div-srv', { period_month: PM, period_year: PY, scores: [] }, 'u1', SUPER),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assign-context 409s when already assigned', async () => {
    const { service, prisma }: any = await boot({
      kpiPeriodLock: { ...mockDelegate(), findUnique: jest.fn().mockResolvedValue({ status: 'assigned' }) },
    });
    prisma.division.findUnique.mockResolvedValue({ id: 'div-srv' });
    await expect(service.getAssignContext('div-srv', 'u1', SUPER)).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('KPIService approve + probation + payroll link', () => {
  function gridStubs(opts: { amount?: number; weightsOk?: boolean; complete?: boolean; contractType?: string | null }) {
    const aspects =
      opts.weightsOk === false
        ? ASPECTS.map((a) => ({ ...a, weight: 0.1 }))
        : ASPECTS;
    const roster = [{ id: 'e1', employeeCode: 'IGD-001', divisionId: 'div-srv', isActive: true, user: { id: 'u-e1' } }];
    return {
      division: { ...mockDelegate(), findUnique: jest.fn().mockResolvedValue({ id: 'div-srv' }) },
      kpiDivisionConfig: {
        ...mockDelegate(),
        findUnique: jest.fn().mockResolvedValue({ divisionId: 'div-srv', defaultAmount: opts.amount ?? 700000 }),
      },
      kpiAspect: { ...mockDelegate(), findMany: jest.fn().mockResolvedValue(aspects) },
      kpiPeriodTarget: {
        ...mockDelegate(),
        findMany: jest.fn().mockResolvedValue([{ aspectId: 'a-kol', target: 385 }]),
      },
      kpiPeriodActual: {
        ...mockDelegate(),
        findMany: jest.fn().mockResolvedValue(opts.complete === false ? [] : [{ aspectId: 'a-kol', value: 385 }]),
      },
      kpiScore: {
        ...mockDelegate(),
        findMany: jest.fn().mockResolvedValue(
          opts.complete === false
            ? []
            : [
                { employeeId: 'e1', aspectId: 'a-kua', value: 130 },
                { employeeId: 'e1', aspectId: 'a-tim', value: 120 },
              ],
        ),
      },
      kpiEmployeeNote: { ...mockDelegate(), findMany: jest.fn().mockResolvedValue([]) },
      kpiPeriodLock: {
        ...mockDelegate(),
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(async ({ create }: any) => create),
      },
      employee: { ...mockDelegate(), findMany: jest.fn().mockResolvedValue(roster) },
      contract: {
        ...mockDelegate(),
        findMany: jest.fn().mockResolvedValue(opts.contractType ? [{ employeeId: 'e1', type: opts.contractType }] : []),
      },
    };
  }

  it('approves a complete period', async () => {
    const { service, prisma }: any = await boot(gridStubs({}));
    const res: any = await service.approvePeriod('div-srv', CM, CY, 'hr1', SUPER);
    expect(res.status).toBe('approved');
    expect(res.lockedBy).toBe('hr1');
    expect(prisma.kpiPeriodLock.upsert).toHaveBeenCalled();
  });

  it('refuses approve when default_amount is not set', async () => {
    const { service }: any = await boot(gridStubs({ amount: 0 }));
    await expect(service.approvePeriod('div-srv', CM, CY, 'hr1', SUPER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses approve when weights do not sum to 1.0', async () => {
    const { service }: any = await boot(gridStubs({ weightsOk: false }));
    await expect(service.approvePeriod('div-srv', CM, CY, 'hr1', SUPER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses approve when scores are missing', async () => {
    const { service }: any = await boot(gridStubs({ complete: false }));
    await expect(service.approvePeriod('div-srv', CM, CY, 'hr1', SUPER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('excludes trial employees from scoring (no KPI until lulus probation)', async () => {
    const { service }: any = await boot(gridStubs({ contractType: 'trial' }));
    const grid: any = await service.getGrid('div-srv', CM, CY);
    expect(grid.employees[0].excludedReason).toMatch(/trial/);
    expect(grid.employees[0].bonus).toBeNull();
  });

  it('payrollKpi returns zero + reason for unapproved periods', async () => {
    const stubs = gridStubs({});
    stubs.kpiPeriodLock.findUnique = jest.fn().mockResolvedValue(null);
    stubs.employee.findUnique = jest.fn().mockResolvedValue({ id: 'e1', divisionId: 'div-srv' });
    const { service }: any = await boot(stubs);
    const res: any = await service.payrollKpi('e1', CM, CY);
    expect(res.bonus.toNumber()).toBe(0);
    expect(res.reason).toMatch(/not approved/);
  });

  it('payrollKpi returns bonus for an approved period', async () => {
    const stubs = gridStubs({});
    // getGrid reads the shell row; an approved shell marks computed periods approved.
    stubs.kpiPeriodLock.findUnique = jest.fn().mockResolvedValue({ status: 'approved' });
    stubs.employee.findUnique = jest.fn().mockResolvedValue({ id: 'e1', divisionId: 'div-srv' });
    const { service }: any = await boot(stubs);
    const computed: any = await service.computeEmployeePeriod({ id: 'e1', divisionId: 'div-srv' }, CM, CY);
    // total = (385/385)*0.2 + (130/100)*0.3 + (120/100)*0.5 = 0.2+0.39+0.6 = 1.19 -> nilai 1.2
    expect(computed.total).toBeCloseTo(1.19, 9);
    expect(computed.nilai).toBe(1.2);
    expect(computed.status).toBe('approved');
    const res: any = await service.payrollKpi('e1', CM, CY);
    expect(res.bonus.toNumber()).toBe(700000 * 1.2);
    expect(res.nilai.toNumber()).toBe(1.2);
    expect(res.reason).toBeNull();
  });

  it('payrollKpi returns zero + reason for trial/probation (auto-0, no system setup)', async () => {
    const stubs = gridStubs({ contractType: 'probation' });
    stubs.kpiPeriodLock.findUnique = jest.fn().mockResolvedValue({ status: 'approved' });
    stubs.employee.findUnique = jest.fn().mockResolvedValue({ id: 'e1', divisionId: 'div-srv' });
    const { service }: any = await boot(stubs);
    const res: any = await service.payrollKpi('e1', CM, CY);
    expect(res.bonus.toNumber()).toBe(0);
    expect(res.reason).toMatch(/probation/);
  });
});

describe('KPIService D6 split (dept subtree scope + aspect freeze)', () => {
  function deptStubs() {
    return {
      department: {
        ...mockDelegate(),
        findMany: jest.fn().mockResolvedValue([
          { id: 'dept-root', parentDepartmentId: null },
          { id: 'dept-child', parentDepartmentId: 'dept-root' },
          { id: 'dept-leaf', parentDepartmentId: 'dept-child' },
          { id: 'dept-other', parentDepartmentId: null },
        ]),
      },
      division: {
        ...mockDelegate(),
        findMany: jest.fn().mockResolvedValue([{ id: 'div-leaf' }, { id: 'div-child' }]),
      },
    };
  }

  it('dept heads see their subtree divisions plus own division', async () => {
    const { service, prisma }: any = await boot({
      ...deptStubs(),
      employee: {
        ...mockDelegate(),
        findUnique: jest.fn().mockResolvedValue({ id: 'e-hs', userId: 'u-hs', departmentId: 'dept-child', divisionId: 'div-own' }),
      },
    });
    const scope: any = await service.scopeDivisionIds('u-hs', ['HS']);
    expect(new Set(scope)).toEqual(new Set(['div-leaf', 'div-child', 'div-own']));
    expect(prisma.division.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { departmentId: { in: expect.arrayContaining(['dept-child', 'dept-leaf']) } } }),
    );
  });

  it('root head sees the whole subtree, other branches excluded', async () => {
    const { service }: any = await boot({
      ...deptStubs(),
      employee: {
        ...mockDelegate(),
        findUnique: jest.fn().mockResolvedValue({ id: 'e-l1', userId: 'u-l1', departmentId: 'dept-root', divisionId: 'div-own' }),
      },
    });
    const scope: any = await service.scopeDivisionIds('u-l1', ['SPV']);
    expect(scope).toEqual(expect.arrayContaining(['div-leaf', 'div-child', 'div-own']));
  });

  it('blocks structural aspect edits once scores exist', async () => {
    const { service }: any = await boot({
      kpiAspect: { ...mockDelegate(), findUnique: jest.fn().mockResolvedValue({ id: 'a1', divisionId: 'div-srv' }) },
      kpiScore: { ...mockDelegate(), findFirst: jest.fn().mockResolvedValue({ id: 's1' }) },
      kpiPeriodTarget: { ...mockDelegate(), findFirst: jest.fn().mockResolvedValue(null) },
      kpiPeriodActual: { ...mockDelegate(), findFirst: jest.fn().mockResolvedValue(null) },
      kpiPeriodLock: { ...mockDelegate(), findFirst: jest.fn().mockResolvedValue(null) },
    });
    await expect(service.updateAspect('a1', { weight: 0.5 })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks structural aspect edits once a period shell exists', async () => {
    const { service }: any = await boot({
      kpiAspect: { ...mockDelegate(), findUnique: jest.fn().mockResolvedValue({ id: 'a1', divisionId: 'div-srv' }) },
      kpiScore: { ...mockDelegate(), findFirst: jest.fn().mockResolvedValue(null) },
      kpiPeriodTarget: { ...mockDelegate(), findFirst: jest.fn().mockResolvedValue(null) },
      kpiPeriodActual: { ...mockDelegate(), findFirst: jest.fn().mockResolvedValue(null) },
      kpiPeriodLock: { ...mockDelegate(), findFirst: jest.fn().mockResolvedValue({ status: 'assigned' }) },
    });
    await expect(service.updateAspect('a1', { weight: 0.5 })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows metadata edits on in-use aspects', async () => {
    const { service, prisma }: any = await boot({
      kpiAspect: {
        ...mockDelegate(),
        findUnique: jest.fn().mockResolvedValue({ id: 'a1', divisionId: 'div-srv' }),
        update: jest.fn().mockResolvedValue({ id: 'a1', name: 'New name' }),
      },
      kpiScore: { ...mockDelegate(), findFirst: jest.fn().mockResolvedValue({ id: 's1' }) },
      kpiPeriodTarget: { ...mockDelegate(), findFirst: jest.fn().mockResolvedValue(null) },
      kpiPeriodActual: { ...mockDelegate(), findFirst: jest.fn().mockResolvedValue(null) },
      kpiPeriodLock: { ...mockDelegate(), findFirst: jest.fn().mockResolvedValue(null) },
    });
    const res: any = await service.updateAspect('a1', { name: 'New name' });
    expect(res.name).toBe('New name');
    expect(prisma.kpiAspect.update).toHaveBeenCalled();
  });
});
