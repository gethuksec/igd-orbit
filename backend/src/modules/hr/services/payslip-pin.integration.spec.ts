import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../shared/services/prisma.service';
import { PasswordService } from '../../../shared/services/password.service';
import { AttendanceService } from './attendance.service';
import { JournalEntriesService } from '../../finance/services/journal-entries.service';
import { PayrollService } from './payroll.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

/**
 * IGDERP-275: payslip PIN set/change/unlock (mocked-Prisma integration,
 * real bcrypt via PasswordService).
 */
describe('PayrollService payslip PIN (IGDERP-275 integration)', () => {
  let service: PayrollService;
  let prisma: any;
  const pinHash = bcrypt.hashSync('123456', 4);

  const slip = {
    id: 'pay-1',
    employeeId: 'emp-1',
    payrollNumber: 'PAY-202611-000001',
    periodMonth: 11,
    periodYear: 2026,
    status: 'paid',
    totalEarnings: { toNumber: () => 5000000 },
    totalDeductions: { toNumber: () => 500000 },
    nettSalary: { toNumber: () => 4500000 },
  };

  beforeEach(async () => {
    prisma = {
      employee: {
        findUnique: jest.fn().mockResolvedValue({ id: 'emp-1', userId: 'u-1', payslipPinHash: null }),
        update: jest.fn(async ({ data }: any) => ({ id: 'emp-1', ...data })),
      },
      payroll: {
        findMany: jest.fn().mockResolvedValue([slip]),
        findUnique: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: prisma },
        PasswordService,
        { provide: AttendanceService, useValue: {} },
        { provide: JournalEntriesService, useValue: {} },
      ],
    }).compile();
    service = module.get<PayrollService>(PayrollService);
  });

  it('first PIN set needs no old PIN', async () => {
    const res = await service.setPayslipPin('u-1', { pin: '123456' } as any);
    expect(res.message).toMatch(/saved/);
    const saved = prisma.employee.update.mock.calls[0][0].data.payslipPinHash;
    expect(await bcrypt.compare('123456', saved)).toBe(true);
  });

  it('change requires correct current PIN', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1', userId: 'u-1', payslipPinHash: pinHash });
    await expect(
      service.setPayslipPin('u-1', { pin: '654321' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.setPayslipPin('u-1', { pin: '654321', oldPin: '000000' } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const res = await service.setPayslipPin('u-1', { pin: '654321', oldPin: '123456' } as any);
    expect(res.message).toMatch(/saved/);
  });

  it('mySlips accepts default 123456 when no PIN set, rejects other PINs', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1', userId: 'u-1', payslipPinHash: null });
    const res = await service.mySlips('u-1', '123456');
    expect(res.total).toBe(1);
    expect(res.data[0].nettSalary).toBe(4500000);
    await expect(service.mySlips('u-1', '000000')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('mySlips unlocks with custom PIN, rejects wrong PIN', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1', userId: 'u-1', payslipPinHash: pinHash });
    const res = await service.mySlips('u-1', '123456');
    expect(res.total).toBe(1);
    await expect(service.mySlips('u-1', '000000')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('unlockSlip returns detail for owner, 403 for another employee slip', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1', userId: 'u-1', payslipPinHash: pinHash });
    prisma.payroll.findUnique.mockResolvedValue({
      ...slip,
      employee: { user: {}, branch: {}, department: {} },
      components: [],
      journalEntry: null,
    });
    const res: any = await service.unlockSlip('u-1', 'pay-1', '123456');
    expect(res.payrollNumber).toBe('PAY-202611-000001');

    prisma.payroll.findUnique.mockResolvedValue({
      ...slip,
      id: 'pay-2',
      employeeId: 'emp-OTHER',
      employee: { user: {}, branch: {}, department: {} },
      components: [],
      journalEntry: null,
    });
    await expect(service.unlockSlip('u-1', 'pay-2', '123456')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
