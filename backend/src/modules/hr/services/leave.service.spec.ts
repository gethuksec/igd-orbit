import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { LeaveService } from './leave.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const CUTI = {
  id: 'lt-cuti',
  code: 'CUTI-TAHUNAN',
  name: 'Cuti Tahunan',
  isPaid: true,
  quotaDays: 12,
  maxApplyDelayDays: null,
  maxRequestsPerMonth: null,
  requiresAttachment: false,
  isActive: true,
};
const SAKIT = {
  id: 'lt-sakit',
  code: 'SAKIT',
  name: 'Sakit',
  isPaid: true,
  quotaDays: 12,
  maxApplyDelayDays: 0,
  maxRequestsPerMonth: 1,
  requiresAttachment: true,
  isActive: true,
};
const UNPAID = {
  id: 'lt-unpaid',
  code: 'TANPA-GAJI',
  name: 'Tanpa Gaji',
  isPaid: false,
  quotaDays: 0,
  maxApplyDelayDays: null,
  maxRequestsPerMonth: null,
  requiresAttachment: false,
  isActive: true,
};

describe('LeaveService master-driven rules (IGDERP-261)', () => {
  let service: LeaveService;
  let prisma: any;

  const byCode: Record<string, any> = {
    'CUTI-TAHUNAN': CUTI,
    SAKIT,
    'TANPA-GAJI': UNPAID,
  };

  beforeEach(async () => {
    prisma = {
      employee: { findUnique: jest.fn().mockResolvedValue({ id: 'emp-1', userId: 'u-1' }) },
      leaveType: {
        findFirst: jest.fn(async ({ where }: any) => byCode[where.code] ?? null),
        findMany: jest.fn().mockResolvedValue([CUTI, SAKIT, UNPAID]),
      },
      leaveRequest: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(async ({ data }: any) => ({ id: 'lr-1', ...data })),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeaveService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<LeaveService>(LeaveService);
  });

  const futureDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    // skip weekends for working-day calc
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  it('rejects unknown leave type codes', async () => {
    await expect(
      service.requestLeave(
        { leave_type: 'CUTI-FIKTIF', start_date: futureDate(10), end_date: futureDate(11), reason: 'x' } as any,
        'u-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps legacy annual code to CUTI-TAHUNAN master', async () => {
    const res: any = await service.requestLeave(
      { leave_type: 'annual', start_date: futureDate(10), end_date: futureDate(10), reason: 'liburan' } as any,
      'u-1',
    );
    expect(res.leaveTypeId).toBe('lt-cuti');
  });

  it('enforces monthly cap for SAKIT (sebulan 1x)', async () => {
    prisma.leaveRequest.count.mockResolvedValue(1); // already filed once this month
    const today = new Date().toISOString().slice(0, 10);
    await expect(
      service.requestLeave(
        { leave_type: 'SAKIT', start_date: today, end_date: today, reason: 'demam', attachment_url: 'http://x/y.jpg' } as any,
        'u-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows SAKIT filed on H day with attachment (max pengajuan hari H)', async () => {
    prisma.leaveRequest.count.mockResolvedValue(0);
    const today = new Date().toISOString().slice(0, 10);
    const res: any = await service.requestLeave(
      { leave_type: 'SAKIT', start_date: today, end_date: today, reason: 'demam', attachment_url: 'http://x/y.jpg' } as any,
      'u-1',
    );
    expect(res.leaveTypeId).toBe('lt-sakit');
  });

  it('requires attachment for SAKIT', async () => {
    prisma.leaveRequest.count.mockResolvedValue(0);
    const today = new Date().toISOString().slice(0, 10);
    await expect(
      service.requestLeave(
        { leave_type: 'SAKIT', start_date: today, end_date: today, reason: 'demam' } as any,
        'u-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('unpaid leave skips quota check', async () => {
    // 30 working days unpaid — far above any quota, must still pass balance gate
    const res: any = await service.requestLeave(
      { leave_type: 'TANPA-GAJI', start_date: futureDate(10), end_date: '2099-12-31', reason: 'istirahat' } as any,
      'u-1',
    );
    expect(res.leaveTypeId).toBe('lt-unpaid');
  });

  it('balance reads quotas from masters, not hardcoded constants', async () => {
    prisma.leaveRequest.findMany.mockResolvedValue([
      { leaveTypeId: 'lt-cuti', totalDays: 2, leaveType: { code: 'CUTI-TAHUNAN' } },
    ]);
    const bal: any = await service.getLeaveBalance('emp-1');
    expect(bal.annual).toMatchObject({ quota: 12, used: 2, remaining: 10 });
    expect(bal.types.find((t: any) => t.code === 'SAKIT')).toMatchObject({ quota: 12, used: 0 });
    expect(bal.unpaid).toMatchObject({ used: 0 });
  });
});
