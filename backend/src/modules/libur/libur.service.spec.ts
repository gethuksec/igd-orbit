import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { ShiftsService } from '../shifts/shifts.service';
import { LiburService } from './libur.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  let shiftsStub: any;

  beforeEach(async () => {
    shiftsStub = {
      canEmployeeInput: jest.fn(async () => ({ open: true, reason: 'open' })),
      resolveShiftForDate: jest.fn(async () => ({ shift: null, source: 'none' })),
    };
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
      shiftRosterEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
      },
      userBranch: { findMany: jest.fn(async () => []) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LiburService,
        { provide: PrismaService, useValue: prisma },
        { provide: ShiftsService, useValue: shiftsStub },
      ],
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
        atasanStatus: 'approved',
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
        atasanStatus: 'approved',
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

    it('requires atasan approval before HR-final', async () => {
      prisma.liburRequest.findUnique.mockResolvedValue({
        id: 'r1',
        employeeId: 'e1',
        targetPeriod: service.currentPeriod(),
        status: 'pending',
        atasanStatus: 'pending',
      });
      await expect(service.approveRequest('r1', 'u-hr')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.liburRequest.update).not.toHaveBeenCalled();
    });
  });

  describe('two-step + bulk (IGDERP-265 gaps)', () => {
    // e1 sits on SE (parent AS-SE, branch b1); u-as holds AS-SE in b1.
    const wireLiburN1 = () => {
      prisma.employee.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'e1') {
          return {
            id: 'e1',
            branchId: 'b1',
            positionId: 'p-se',
            position: { id: 'p-se', parentPositionId: 'p-as' },
          };
        }
        if (where.userId === 'u-as') {
          return { id: 'emp-as', positionId: 'p-as', branchId: 'b1', isActive: true };
        }
        if (where.userId === 'u-hs') {
          return { id: 'emp-hs', positionId: 'p-hs', branchId: 'b1', isActive: true };
        }
        return null;
      });
    };

    it('atasanApprove flips atasanStatus, keeps status pending', async () => {
      prisma.liburRequest.findUnique.mockResolvedValue({
        id: 'r1',
        employeeId: 'e1',
        targetPeriod: service.currentPeriod(),
        date: new Date().toISOString(),
        status: 'pending',
        atasanStatus: 'pending',
      });
      prisma.liburRequest.update.mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data }));
      prisma.liburRequest.findMany.mockResolvedValue([]);
      wireLiburN1();
      const res: any = await service.atasanApprove('r1', 'u-as', ['AS-SE']);
      expect(res.atasanStatus).toBe('approved');
      expect(res.status).toBeUndefined();
      expect(res.consecutiveWarning).toEqual([]);
    });

    it('atasanApprove rejects a same-branch higher rank from another line (HS)', async () => {
      prisma.liburRequest.findUnique.mockResolvedValue({
        id: 'r1',
        employeeId: 'e1',
        targetPeriod: service.currentPeriod(),
        date: new Date().toISOString(),
        status: 'pending',
        atasanStatus: 'pending',
      });
      wireLiburN1();
      await expect(service.atasanApprove('r1', 'u-hs', ['HS'])).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('atasanReject closes the request terminally', async () => {
      prisma.liburRequest.findUnique.mockResolvedValue({ id: 'r1', employeeId: 'e1', status: 'pending', atasanStatus: 'pending' });
      prisma.liburRequest.update.mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data }));
      wireLiburN1();
      const res: any = await service.atasanReject('r1', { reason: 'kurang orang' } as any, 'u-as', ['AS-SE']);
      expect(res).toMatchObject({ status: 'rejected', atasanStatus: 'rejected' });
    });

    it('bulkApprove is partial-fail safe', async () => {
      prisma.liburRequest.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'ok') {
          return {
            id: 'ok',
            employeeId: 'e1',
            targetPeriod: service.currentPeriod(),
            date: new Date().toISOString(),
            status: 'pending',
            atasanStatus: 'approved',
            employee: { branchId: null },
          };
        }
        return { id: 'bad', status: 'pending', atasanStatus: 'pending' };
      });
      prisma.liburRequest.update.mockImplementation(async ({ data }: any) => ({ ...data }));
      prisma.liburQuotaConfig.findFirst.mockResolvedValue({ id: 'g1', employeeId: null, quotaDays: 4 });
      prisma.liburRequest.count.mockResolvedValue(1);
      prisma.liburRequest.findMany.mockResolvedValue([]);
      const res: any = await service.bulkApprove({ ids: ['ok', 'bad'] } as any, 'u-hr');
      expect(res.approved).toHaveLength(1);
      expect(res.failed).toHaveLength(1);
      expect(res.failed[0].id).toBe('bad');
    });

    it('createRequest warns on consecutive run, blocks when gate closed', async () => {
      // gate closed
      shiftsStub.canEmployeeInput.mockResolvedValueOnce({ open: false, reason: 'not-released' });
      prisma.employee.findUnique.mockResolvedValue({ id: 'e1', branchId: 'b1' });
      await expect(
        service.createRequest({ employeeId: 'e1', date: dateInMonthOffset(0) } as any, 'u1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.liburRequest.create).not.toHaveBeenCalled();
    });

    it('findConsecutiveWarning reports runs across approved + offDates', async () => {
      const period = service.currentPeriod();
      const [y, m] = period.split('-').map(Number);
      const iso = (d: number) => new Date(y, m - 1, d).toISOString();
      prisma.liburRequest.findMany.mockResolvedValue([{ date: iso(10) }]);
      (prisma as any).shiftAssignment = { findMany: jest.fn(async () => [{ offDates: [iso(12)] }]) };
      const warn: string[] = await service.findConsecutiveWarning('e1', period, iso(11));
      expect(warn).toHaveLength(3);
    });

    it('HR-final approve plots the roster libur day (null shiftId)', async () => {
      const date = new Date().toISOString();
      prisma.liburRequest.findUnique.mockResolvedValue({
        id: 'r1',
        employeeId: 'e1',
        targetPeriod: service.currentPeriod(),
        date,
        status: 'pending',
        atasanStatus: 'approved',
        employee: { id: 'e1', divisionId: 'div-1' },
      });
      prisma.liburRequest.update.mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data }));
      prisma.liburQuotaConfig.findFirst.mockResolvedValue({ id: 'g1', employeeId: null, quotaDays: 4 });
      prisma.liburRequest.count.mockResolvedValue(1);
      prisma.liburRequest.findMany.mockResolvedValue([]);
      prisma.shiftRosterEntry.upsert.mockImplementation(async (args: any) => args.create);
      const res: any = await service.approveRequest('r1', 'u-hr');
      expect(res.status).toBe('approved');
      expect(prisma.shiftRosterEntry.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ shiftId: null, submitted: true }),
        }),
      );
    });

    it('cancel of an approved request unplots its roster libur day', async () => {
      const date = new Date().toISOString();
      prisma.liburRequest.findUnique.mockResolvedValue({
        id: 'r1',
        employeeId: 'e1',
        date,
        status: 'approved',
      });
      prisma.liburRequest.update.mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data }));
      prisma.shiftRosterEntry.findUnique.mockResolvedValue({ id: 'cell-1', shiftId: null });
      prisma.shiftRosterEntry.delete.mockResolvedValue({ id: 'cell-1' });
      await service.cancelRequest('r1');
      expect(prisma.shiftRosterEntry.delete).toHaveBeenCalledWith({ where: { id: 'cell-1' } });
    });

    it('cancel keeps a replotted (shift) roster cell', async () => {
      prisma.liburRequest.findUnique.mockResolvedValue({
        id: 'r1',
        employeeId: 'e1',
        date: new Date().toISOString(),
        status: 'approved',
      });
      prisma.liburRequest.update.mockImplementation(async ({ data }: any) => ({ id: 'r1', ...data }));
      prisma.shiftRosterEntry.findUnique.mockResolvedValue({ id: 'cell-1', shiftId: 'sh-9' });
      await service.cancelRequest('r1');
      expect(prisma.shiftRosterEntry.delete).not.toHaveBeenCalled();
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
