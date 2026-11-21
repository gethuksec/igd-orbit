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
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  };
}

const ASPECTS = [
  { id: 'a-kol', divisionId: 'div-srv', code: 'HP_DONE', targetType: 'PERIOD', fixedTarget: null, weight: 0.2, isKolektif: true, intervalMin: 60, intervalMax: 140, isActive: true },
  { id: 'a-kua', divisionId: 'div-srv', code: 'KUALITAS', targetType: 'FIXED', fixedTarget: 100, weight: 0.3, isKolektif: false, intervalMin: 60, intervalMax: 140, isActive: true },
  { id: 'a-tim', divisionId: 'div-srv', code: 'TEAMWORK', targetType: 'FIXED', fixedTarget: 100, weight: 0.5, isKolektif: false, intervalMin: 60, intervalMax: 140, isActive: true },
];

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
});

describe('KPIService grid guards', () => {
  it('refuses writes to a locked period', async () => {
    const { service, prisma }: any = await boot();
    prisma.kpiPeriodLock.findUnique.mockResolvedValue({ status: 'locked' });
    await expect(
      service.saveGrid('div-srv', { period_month: 10, period_year: 2026, scores: [] }, 'u1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects individual scores outside the aspect interval', async () => {
    const { service, prisma }: any = await boot();
    prisma.kpiPeriodLock.findUnique.mockResolvedValue(null);
    prisma.kpiAspect.findMany.mockResolvedValue(ASPECTS);
    await expect(
      service.saveGrid(
        'div-srv',
        { period_month: 10, period_year: 2026, scores: [{ employeeId: 'e1', aspectId: 'a-kua', value: 55 }] },
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects kolektif aspects scored per employee and vice versa', async () => {
    const { service, prisma }: any = await boot();
    prisma.kpiPeriodLock.findUnique.mockResolvedValue(null);
    prisma.kpiAspect.findMany.mockResolvedValue(ASPECTS);
    prisma.employee.findUnique.mockResolvedValue({ id: 'e1', divisionId: 'div-srv' });
    await expect(
      service.saveGrid(
        'div-srv',
        { period_month: 10, period_year: 2026, scores: [{ employeeId: 'e1', aspectId: 'a-kol', value: 100 }] },
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.saveGrid('div-srv', { period_month: 10, period_year: 2026, kolektif: [{ aspectId: 'a-kua', value: 100 }] }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects aspects from another division', async () => {
    const { service, prisma }: any = await boot();
    prisma.kpiPeriodLock.findUnique.mockResolvedValue(null);
    prisma.kpiAspect.findMany.mockResolvedValue(ASPECTS);
    await expect(
      service.saveGrid('div-srv', { period_month: 10, period_year: 2026, targets: [{ aspectId: 'other', target: 5 }] }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('KPIService lock + probation + payroll link', () => {
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

  it('locks a complete period', async () => {
    const { service, prisma }: any = await boot(gridStubs({}));
    const res: any = await service.lockPeriod('div-srv', 10, 2026, 'hr1');
    expect(res.status).toBe('locked');
    expect(res.lockedBy).toBe('hr1');
    expect(prisma.kpiPeriodLock.upsert).toHaveBeenCalled();
  });

  it('refuses lock when default_amount is not set', async () => {
    const { service }: any = await boot(gridStubs({ amount: 0 }));
    await expect(service.lockPeriod('div-srv', 10, 2026, 'hr1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses lock when weights do not sum to 1.0', async () => {
    const { service }: any = await boot(gridStubs({ weightsOk: false }));
    await expect(service.lockPeriod('div-srv', 10, 2026, 'hr1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses lock when scores are missing', async () => {
    const { service }: any = await boot(gridStubs({ complete: false }));
    await expect(service.lockPeriod('div-srv', 10, 2026, 'hr1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('excludes trial employees from scoring (no KPI until lulus probation)', async () => {
    const { service }: any = await boot(gridStubs({ contractType: 'trial' }));
    const grid: any = await service.getGrid('div-srv', 10, 2026);
    expect(grid.employees[0].excludedReason).toMatch(/trial/);
    expect(grid.employees[0].bonus).toBeNull();
  });

  it('payrollKpi returns zero + reason for unlocked periods', async () => {
    const stubs = gridStubs({});
    stubs.kpiPeriodLock.findUnique = jest.fn().mockResolvedValue(null);
    stubs.employee.findUnique = jest.fn().mockResolvedValue({ id: 'e1', divisionId: 'div-srv' });
    const { service }: any = await boot(stubs);
    const res: any = await service.payrollKpi('e1', 10, 2026);
    expect(res.bonus.toNumber()).toBe(0);
    expect(res.reason).toMatch(/not locked/);
  });

  it('payrollKpi returns bonus for a locked period', async () => {
    const stubs = gridStubs({});
    // getGrid reads the lock row; a present locked row marks computed periods locked.
    stubs.kpiPeriodLock.findUnique = jest.fn().mockResolvedValue({ status: 'locked' });
    stubs.employee.findUnique = jest.fn().mockResolvedValue({ id: 'e1', divisionId: 'div-srv' });
    const { service }: any = await boot(stubs);
    const computed: any = await service.computeEmployeePeriod({ id: 'e1', divisionId: 'div-srv' }, 10, 2026);
    // total = (385/385)*0.2 + (130/100)*0.3 + (120/100)*0.5 = 0.2+0.39+0.6 = 1.19 -> nilai 1.2
    expect(computed.total).toBeCloseTo(1.19, 9);
    expect(computed.nilai).toBe(1.2);
    expect(computed.status).toBe('locked');
    const res: any = await service.payrollKpi('e1', 10, 2026);
    expect(res.bonus.toNumber()).toBe(700000 * 1.2);
    expect(res.nilai.toNumber()).toBe(1.2);
    expect(res.reason).toBeNull();
  });
});
