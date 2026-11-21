import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { LiburService } from './libur.service';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

function dateInMonthOffset(offset: number, day = 10): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, day);
  return d.toISOString().slice(0, 10);
}

describe('LiburService', () => {
  let service: LiburService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      employee: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
      liburQuotaConfig: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        deleteMany: jest.fn(),
      },
      liburRequest: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [LiburService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<LiburService>(LiburService);
  });

  describe('getQuotas — global vs override resolution', () => {
    it('creates the global default row (4 days) when missing', async () => {
      prisma.liburQuotaConfig.findFirst.mockResolvedValue(null);
      prisma.liburQuotaConfig.create.mockImplementation(async ({ data }: any) => ({
        id: 'g1',
        ...data,
      }));
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.employee.count.mockResolvedValue(0);
      prisma.liburRequest.findMany.mockResolvedValue([]);

      const res: any = await service.getQuotas({});
      expect(prisma.liburQuotaConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ quotaDays: 4 }) }),
      );
      expect(res.globalQuotaDays).toBe(4);
      expect(res.data).toEqual([]);
    });

    it('resolves override (khusus) vs global quota per employee', async () => {
      prisma.liburQuotaConfig.findFirst.mockResolvedValue({ id: 'g1', employeeId: null, quotaDays: 4 });
      prisma.employee.findMany.mockResolvedValue([
        {
          id: 'e1',
          employeeCode: 'EMP-001',
          user: { fullName: 'Andi' },
          liburQuotaConfig: { id: 'o1', employeeId: 'e1', quotaDays: 6 },
        },
        {
          id: 'e2',
          employeeCode: 'EMP-002',
          user: { fullName: 'Budi' },
          liburQuotaConfig: null,
        },
      ]);
      prisma.employee.count.mockResolvedValue(2);
      prisma.liburRequest.findMany.mockResolvedValue([
        { employeeId: 'e1', status: 'approved' },
        { employeeId: 'e1', status: 'approved' },
        { employeeId: 'e1', status: 'pending' },
        { employeeId: 'e2', status: 'approved' },
      ]);

      const res: any = await service.getQuotas({});
      expect(res.globalQuotaDays).toBe(4);
      const [a, b] = res.data;
      expect(a).toMatchObject({
        employeeId: 'e1',
        employeeCode: 'EMP-001',
        fullName: 'Andi',
        quotaDays: 6,
        quotaSource: 'khusus',
        used: 2,
        pending: 1,
        remaining: 4,
        overQuotaDays: 0,
        isOverQuota: false,
      });
      expect(b).toMatchObject({
        employeeId: 'e2',
        quotaDays: 4,
        quotaSource: 'global',
        used: 1,
        pending: 0,
        remaining: 3,
      });
    });

    it('flags over-quota employees', async () => {
      prisma.liburQuotaConfig.findFirst.mockResolvedValue({ id: 'g1', employeeId: null, quotaDays: 2 });
      prisma.employee.findMany.mockResolvedValue([
        { id: 'e1', employeeCode: 'EMP-001', user: { fullName: 'Cici' }, liburQuotaConfig: null },
      ]);
      prisma.employee.count.mockResolvedValue(1);
      prisma.liburRequest.findMany.mockResolvedValue([
        { employeeId: 'e1', status: 'approved' },
        { employeeId: 'e1', status: 'approved' },
        { employeeId: 'e1', status: 'approved' },
      ]);

      const res: any = await service.getQuotas({});
      expect(res.data[0]).toMatchObject({
        quotaDays: 2,
        used: 3,
        remaining: -1,
        overQuotaDays: 1,
        isOverQuota: true,
      });
    });
  });

  describe('createRequest — kind auto + guards', () => {
    beforeEach(() => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'e1' });
      prisma.liburRequest.findFirst.mockResolvedValue(null);
      prisma.liburRequest.create.mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data }));
    });

    it('marks current-month dates as current', async () => {
      const res: any = await service.createRequest(
        { employeeId: 'e1', date: dateInMonthOffset(0) } as any,
        'u1',
      );
      expect(res.kind).toBe('current');
      expect(res.targetPeriod).toBe(service.currentPeriod());
    });

    it('marks next-month dates as advance', async () => {
      const res: any = await service.createRequest(
        { employeeId: 'e1', date: dateInMonthOffset(1) } as any,
        'u1',
      );
      expect(res.kind).toBe('advance');
    });

    it('rejects dates outside current/next month', async () => {
      await expect(
        service.createRequest({ employeeId: 'e1', date: dateInMonthOffset(2) } as any, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.createRequest({ employeeId: 'e1', date: dateInMonthOffset(-1) } as any, 'u1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects duplicate non-cancelled requests (409)', async () => {
      prisma.liburRequest.findFirst.mockResolvedValue({ id: 'existing', status: 'pending' });
      await expect(
        service.createRequest({ employeeId: 'e1', date: dateInMonthOffset(0) } as any, 'u1'),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.liburRequest.create).not.toHaveBeenCalled();
    });

    it('throws 404 for unknown employee', async () => {
      prisma.employee.findUnique.mockResolvedValue(null);
      await expect(
        service.createRequest({ employeeId: 'nope', date: dateInMonthOffset(0) } as any, 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('approveRequest — overQuota flag', () => {
    it('returns overQuota=true when used exceeds quota after approve', async () => {
      prisma.liburRequest.findUnique.mockResolvedValue({
        id: 'r1',
        employeeId: 'e1',
        targetPeriod: service.currentPeriod(),
        status: 'pending',
      });
      prisma.liburRequest.update.mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data }));
      prisma.liburQuotaConfig.findFirst
        .mockResolvedValueOnce({ id: 'g1', employeeId: null, quotaDays: 1 }) // global
        .mockResolvedValueOnce(null); // no override
      prisma.liburRequest.count.mockResolvedValue(2);

      const res: any = await service.approveRequest('r1', 'u-admin');
      expect(res.status).toBe('approved');
      expect(res.overQuota).toBe(true);
    });

    it('returns overQuota=false within quota and never creates penalties', async () => {
      prisma.liburRequest.findUnique.mockResolvedValue({
        id: 'r1',
        employeeId: 'e1',
        targetPeriod: service.currentPeriod(),
        status: 'pending',
      });
      prisma.liburRequest.update.mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data }));
      prisma.liburQuotaConfig.findFirst
        .mockResolvedValueOnce({ id: 'g1', employeeId: null, quotaDays: 4 })
        .mockResolvedValueOnce({ id: 'o1', employeeId: 'e1', quotaDays: 5 });
      prisma.liburRequest.count.mockResolvedValue(3);

      const res: any = await service.approveRequest('r1', 'u-admin');
      expect(res.overQuota).toBe(false);
      expect((prisma as any).penalty).toBeUndefined();
    });

    it('rejects non-pending requests', async () => {
      prisma.liburRequest.findUnique.mockResolvedValue({ id: 'r1', status: 'approved' });
      await expect(service.approveRequest('r1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updateEmployeeQuota', () => {
    it('null quotaDays deletes the override', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'e1' });
      prisma.liburQuotaConfig.deleteMany.mockResolvedValue({ count: 1 });
      prisma.liburQuotaConfig.findFirst.mockResolvedValue({ id: 'g1', employeeId: null, quotaDays: 4 });

      const res: any = await service.updateEmployeeQuota('e1', { quotaDays: null } as any);
      expect(prisma.liburQuotaConfig.deleteMany).toHaveBeenCalledWith({
        where: { employeeId: 'e1' },
      });
      expect(res).toMatchObject({ employeeId: 'e1', quotaSource: 'global' });
    });
  });
});
