import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { PenaltyTypesService } from '../../penalty-types/penalty-types.service';
import { PayrollComponentsService } from './payroll-components.service';

/**
 * Payroll master boundary (IGDERP-284): the create-period popup reads two
 * lists — non-denda components from PayrollComponentMaster plus the denda
 * section from PenaltyType. Denda codes must not collide with component
 * codes, and the checklist query must hide inactive/deleted rows.
 */
describe('Payroll master boundary (integration)', () => {
  let components: PayrollComponentsService;
  let penalties: PenaltyTypesService;
  let prisma: any;

  const componentRows = [
    { id: 'c-1', code: 'GAJI-POKOK', name: 'Gaji Pokok', category: 'earning', source: 'manual', isActive: true },
    { id: 'c-2', code: 'TUNJ-JABATAN', name: 'Tunjangan Jabatan', category: 'earning', source: 'grade', isActive: true },
    { id: 'c-3', code: 'NOMINAL-TFS', name: 'Nominal T/F/S', category: 'deduction', source: 'computed', isActive: true },
    { id: 'c-4', code: 'BPJS-JKK', name: 'BPJS JKK', category: 'deduction', source: 'fixed', isActive: false },
  ];
  const penaltyRows = [
    { id: 'p-1', code: 'DENDA-TERLAMBAT', name: 'Denda Terlambat', priority: 5 },
    { id: 'p-2', code: 'DENDA-ALPHA', name: 'Alpha', priority: 10 },
  ];

  beforeEach(async () => {
    prisma = {
      payrollComponentMaster: {
        findUnique: jest.fn(async ({ where }: any) =>
          componentRows.find((r) => r.code === where.code) ?? null,
        ),
        findFirst: jest.fn(async ({ where }: any) =>
          componentRows.find((r) => (where.id ? r.id === where.id : true) && (where.name ? r.name === where.name : true)) ?? null,
        ),
        findMany: jest.fn(async ({ where }: any) => {
          let rows = [...componentRows];
          if (where?.isActive !== undefined) rows = rows.filter((r) => r.isActive === where.isActive);
          if (where?.category) rows = rows.filter((r) => r.category === where.category);
          return rows;
        }),
        count: jest.fn(async () => componentRows.length),
        create: jest.fn(),
        update: jest.fn(),
      },
      penaltyType: {
        findMany: jest.fn(async () => penaltyRows),
        count: jest.fn(async () => penaltyRows.length),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollComponentsService,
        PenaltyTypesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    components = module.get(PayrollComponentsService);
    penalties = module.get(PenaltyTypesService);
  });

  it('popup lists: active components + full denda section, no code overlap', async () => {
    const list: any = await components.findAll({});
    const denda: any = await penalties.findAll({} as any);
    const componentCodes = new Set(list.data.map((r: any) => r.code));
    expect(list.data).toHaveLength(3);
    expect(list.data.every((r: any) => r.isActive)).toBe(true);
    for (const p of denda.data) {
      expect(componentCodes.has(p.code)).toBe(false);
    }
  });

  it('deduction-only filter feeds the potongan group', async () => {
    const list: any = await components.findAll({ category: 'deduction' });
    expect(list.data.map((r: any) => r.code)).toEqual(['NOMINAL-TFS']);
  });

  it('grade-source row carries the G1-G3 ladder for prefill', async () => {
    prisma.payrollComponentMaster.findFirst.mockResolvedValueOnce({
      ...componentRows[1],
      tiers: { G1: 700000, G2: 400000, G3: 200000 },
    });
    const row: any = await components.findById('c-2');
    expect(row.tiers).toMatchObject({ G1: 700000, G2: 400000, G3: 200000 });
  });
});
