import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../shared/services/prisma.service';
import { AttendanceService } from './attendance.service';
import { JournalEntriesService } from '../../finance/services/journal-entries.service';
import { PasswordService } from '../../../shared/services/password.service';
import { KPIService } from './kpi.service';
import { PayrollService } from './payroll.service';
import { CalculatePayrollDto } from '../dto/calculate-payroll.dto';

/**
 * Hitung page contract (IGDERP-289): only selected ComponentMaster rows
 * resolve into payroll rows; amounts follow the Format_HR_ORBIT.xlsx
 * Payroll sheet formulas; unknown/inactive masters are rejected.
 */
describe('PayrollService.calculatePayroll (master checklist)', () => {
  let service: PayrollService;
  let prisma: any;
  let createdRows: any[];

  const masters = [
    { id: 'm-gaji', code: 'GAJI-POKOK', name: 'Gaji Pokok', category: 'earning', source: 'manual', defaultAmount: null, tiers: null, isActive: true },
    { id: 'm-selisih', code: 'SELISIH', name: 'Selisih', category: 'earning', source: 'manual', defaultAmount: null, tiers: null, isActive: true },
    { id: 'm-tfs', code: 'NOMINAL-TFS', name: 'Nominal T/F/S', category: 'deduction', source: 'computed', defaultAmount: null, tiers: null, isActive: true },
    { id: 'm-kpi', code: 'TOTAL-KPI', name: 'Total KPI', category: 'earning', source: 'computed', defaultAmount: null, tiers: null, isActive: true },
    { id: 'm-off', code: 'BPJS-JKK', name: 'BPJS JKK', category: 'deduction', source: 'fixed', defaultAmount: null, tiers: null, isActive: false },
    { id: 'm-trans', code: 'TRANSPORTASI', name: 'Transportasi', category: 'earning', source: 'fixed', defaultAmount: new Decimal(50000), tiers: null, isActive: true },
    { id: 'm-custom', code: 'CUSTOM-GRADE', name: 'Custom', category: 'earning', source: 'grade', defaultAmount: null, tiers: { G1: 700000 }, isActive: true },
  ];

  const employee: any = {
    id: 'emp-1',
    employeeCode: 'IGD.23-0008',
    basicSalary: new Decimal(1400000),
    hourlyRate: new Decimal(10000),
    hireDate: new Date('2020-01-01'),
    userId: 'u-1',
    user: { id: 'u-1', fullName: 'Bintang Permata' },
    branch: { id: 'b-1' },
    department: { id: 'd-1' },
    position: { id: 'p-1', name: 'teknisi-1', grade: { code: 'G1' } },
  };

  const summary: any = {
    presentDays: 25,
    lateCount: 2,
    earlyLeaveCount: 1,
    absenceCount: 0,
    leaveCount: 1,
    totalLateMinutes: 30,
    totalOvertimeHours: 5,
  };

  const penaltyWithRate = [{ code: 'DENDA-TERLAMBAT', defaultAmount: new Decimal(15000) }];

  beforeEach(async () => {
    createdRows = [];
    prisma = {
      payrollComponentMaster: {
        findMany: jest.fn(async ({ where }: any) =>
          masters.filter((m) => where.id.in.includes(m.id)),
        ),
      },
      penaltyType: {
        findMany: jest.fn(async () => penaltyWithRate),
      },
      employee: {
        findMany: jest.fn(async () => [employee]),
      },
      leaveRequest: {
        findMany: jest.fn(async () => []),
      },
      payroll: {
        findUnique: jest.fn(async () => null),
        findFirst: jest.fn(async () => null),
        upsert: jest.fn(async ({ create }: any) => ({ id: 'pay-1', payrollNumber: 'PAY-202611-000001', ...create })),
      },
      payrollComponent: {
        deleteMany: jest.fn(async () => ({ count: 0 })),
        create: jest.fn(async ({ data }: any) => {
          createdRows.push(data);
          return { id: `c-${createdRows.length}`, ...data };
        }),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: prisma },
        { provide: AttendanceService, useValue: { getMonthlySummary: jest.fn(async () => summary) } },
        { provide: JournalEntriesService, useValue: {} },
        { provide: PasswordService, useValue: {} },
        {
          provide: KPIService,
          useValue: { payrollKpi: jest.fn(async () => ({ bonus: new Decimal(1100000), nilai: new Decimal(1.1), reason: null })) },
        },
      ],
    }).compile();
    service = module.get<PayrollService>(PayrollService);
  });

  const dto = (components: Array<{ masterId: string; notes?: string }>) =>
    ({ period_month: 11, period_year: 2026, components }) as CalculatePayrollDto;

  it('rejects unknown master ids', async () => {
    await expect(service.calculatePayroll(dto([{ masterId: '00000000-0000-4000-8000-000000000000' }]), 'u-admin')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects inactive masters', async () => {
    await expect(service.calculatePayroll(dto([{ masterId: 'm-off' }]), 'u-admin')).rejects.toThrow(/nonaktif/);
  });

  it('resolves only selected masters with sheet formulas; KPI excluded when unselected', async () => {
    const res = await service.calculatePayroll(
      dto([{ masterId: 'm-gaji' }, { masterId: 'm-selisih', notes: 'kurang input' }, { masterId: 'm-tfs' }]),
      'u-admin',
    );
    expect(res.calculatedPayrolls).toBe(1);
    const byName = new Map(createdRows.map((r) => [r.name, r]));
    // GAJI-POKOK = kontrak basicSalary
    expect(byName.get('Gaji Pokok').amount.toNumber()).toBe(1400000);
    // SELISIH manual -> 0, catatan HR preserved
    expect(byName.get('Selisih').amount.toNumber()).toBe(0);
    expect(byName.get('Selisih').notes).toBe('kurang input');
    // NOMINAL-TFS = 2 hari x 15.000 (penalty rate)
    expect(byName.get('Nominal T/F/S').amount.toNumber()).toBe(30000);
    expect(byName.get('Nominal T/F/S').type).toBe('deduction');
    // TOTAL-KPI computed internally but NOT selected -> no row (old behavior would include it)
    expect(byName.has('Total KPI')).toBe(false);
    expect(byName.has('KPI Bonus')).toBe(false);
    // totals follow selected rows only: 1.400.000 - 30.000
    expect(res.payrolls[0].nettSalary).toBe(1370000);
  });

  it('falls back to sheet rates when the PenaltyType row is missing', async () => {
    prisma.penaltyType.findMany.mockResolvedValueOnce([]);
    await service.calculatePayroll(dto([{ masterId: 'm-gaji' }, { masterId: 'm-tfs' }]), 'u-admin');
    const row = createdRows.find((r) => r.name === 'Nominal T/F/S');
    expect(row.amount.toNumber()).toBe(30000);
    expect(row.formula).toContain('15.000');
  });

  it('resolves fixed masters from defaultAmount and grade customs from tiers', async () => {
    await service.calculatePayroll(dto([{ masterId: 'm-trans' }, { masterId: 'm-custom' }]), 'u-admin');
    const byName = new Map(createdRows.map((r) => [r.name, r]));
    expect(byName.get('Transportasi').amount.toNumber()).toBe(50000);
    expect(byName.get('Custom').amount.toNumber()).toBe(700000);
  });

  it('skips non-draft payrolls without touching components', async () => {
    prisma.payroll.findUnique.mockResolvedValueOnce({ id: 'pay-old', status: 'approved', payrollNumber: 'X' });
    const res = await service.calculatePayroll(dto([{ masterId: 'm-gaji' }]), 'u-admin');
    expect(res.calculatedPayrolls).toBe(0);
    expect(prisma.payrollComponent.deleteMany).not.toHaveBeenCalled();
  });

  it('DTO rejects an empty component list (mandatory min 1)', async () => {
    const bad = plainToInstance(CalculatePayrollDto, { period_month: 11, period_year: 2026, components: [] });
    const errors = await validate(bad);
    expect(errors.length).toBeGreaterThan(0);
    expect(JSON.stringify(errors)).toContain('Minimal 1 komponen');
  });
});
