import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { ShiftsService } from '../shifts/shifts.service';
import { LiburService } from './libur.service';
import { BadRequestException } from '@nestjs/common';

/**
 * Libur quota math + period rules (mocked prisma).
 * Exercises the pure rules end-to-end through the service:
 * remaining/overQuota math, period defaulting, kind derivation, next-period calc.
 */
describe('LiburService integration — quota math & period rules', () => {
  let service: LiburService;
  let prisma: any;

  const quotaConfigRows: any[] = [];
  const requestRows: any[] = [
    // e1: 5 approved in current period, no override (global 4) => over quota by 1
    // e2: 2 approved + 1 pending, override 6 => fine
  ];

  beforeEach(async () => {
    quotaConfigRows.length = 0;
    quotaConfigRows.push({ id: 'g1', employeeId: null, quotaDays: 4 });
    quotaConfigRows.push({ id: 'o2', employeeId: 'e2', quotaDays: 6 });

    const now = new Date();
    const pad = (n: number) => `${n}`.padStart(2, '0');
    const cur = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    requestRows.length = 0;
    for (let i = 0; i < 5; i++) requestRows.push({ employeeId: 'e1', status: 'approved', targetPeriod: cur });
    requestRows.push({ employeeId: 'e1', status: 'pending', targetPeriod: cur });
    requestRows.push({ employeeId: 'e2', status: 'approved', targetPeriod: cur });
    requestRows.push({ employeeId: 'e2', status: 'approved', targetPeriod: cur });
    requestRows.push({ employeeId: 'e2', status: 'pending', targetPeriod: cur });

    prisma = {
      employee: {
        findMany: jest.fn(async () => [
          { id: 'e1', employeeCode: 'EMP-001', user: { fullName: 'Andi' }, liburQuotaConfig: null },
          {
            id: 'e2',
            employeeCode: 'EMP-002',
            user: { fullName: 'Budi' },
            liburQuotaConfig: { id: 'o2', employeeId: 'e2', quotaDays: 6 },
          },
        ]),
        count: jest.fn(async () => 2),
        findUnique: jest.fn(async () => ({ id: 'e1' })),
      },
      liburQuotaConfig: {
        findFirst: jest.fn(async ({ where }: any) =>
          quotaConfigRows.find((r) =>
            where?.employeeId === null ? r.employeeId === null : r.employeeId === where?.employeeId,
          ) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: `q${quotaConfigRows.length + 1}`, ...data };
          quotaConfigRows.push(row);
          return row;
        }),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      liburRequest: {
        findMany: jest.fn(async ({ where }: any) =>
          requestRows.filter(
            (r) =>
              (!where?.targetPeriod || r.targetPeriod === where.targetPeriod) &&
              (!where?.status?.in || where.status.in.includes(r.status)),
          ),
        ),
        count: jest.fn(async ({ where }: any) =>
          requestRows.filter(
            (r) =>
              r.employeeId === where?.employeeId &&
              r.targetPeriod === where?.targetPeriod &&
              r.status === where?.status,
          ).length,
        ),
        findFirst: jest.fn(async () => null),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiburService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ShiftsService,
          useValue: {
            canEmployeeInput: jest.fn(async () => ({ open: true, reason: 'open' })),
            resolveShiftForDate: jest.fn(async () => ({ shift: null, source: 'none' })),
          },
        },
      ],
    }).compile();
    service = module.get<LiburService>(LiburService);
  });

  it('defaults period to the current month', async () => {
    const res: any = await service.getQuotas({});
    expect(res.period).toBe(service.currentPeriod());
    expect(res.meta.total).toBe(2);
  });

  it('computes remaining / overQuotaDays / isOverQuota correctly', async () => {
    const res: any = await service.getQuotas({});
    const e1 = res.data.find((r: any) => r.employeeId === 'e1');
    const e2 = res.data.find((r: any) => r.employeeId === 'e2');

    // global 4, used 5 => remaining -1, over by 1
    expect(e1).toMatchObject({
      quotaDays: 4,
      quotaSource: 'global',
      used: 5,
      pending: 1,
      remaining: -1,
      overQuotaDays: 1,
      isOverQuota: true,
    });
    // override 6, used 2 => remaining 4, not over
    expect(e2).toMatchObject({
      quotaDays: 6,
      quotaSource: 'khusus',
      used: 2,
      pending: 1,
      remaining: 4,
      overQuotaDays: 0,
      isOverQuota: false,
    });
    expect(res.globalQuotaDays).toBe(4);
  });

  it('uses an explicit period for usage counting', async () => {
    const res: any = await service.getQuotas({ period: '2030-01' });
    expect(res.period).toBe('2030-01');
    for (const row of res.data) {
      expect(row.used).toBe(0);
      expect(row.pending).toBe(0);
      expect(row.isOverQuota).toBe(false);
    }
  });

  it('rejects malformed periods', async () => {
    await expect(service.getQuotas({ period: '2026-13' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.getQuotas({ period: 'januari' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.listRequests({ period: '26-01' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('derives kind: current vs advance, rejects the rest', () => {
    const cur = service.currentPeriod();
    expect(service.resolveKind(cur)).toBe('current');
    expect(service.resolveKind(service.nextPeriod(cur))).toBe('advance');
    expect(() => service.resolveKind('1999-01')).toThrow(BadRequestException);
  });

  it('nextPeriod rolls over December -> January', () => {
    expect(service.nextPeriod('2026-12')).toBe('2027-01');
    expect(service.nextPeriod('2026-01')).toBe('2026-02');
  });
});
