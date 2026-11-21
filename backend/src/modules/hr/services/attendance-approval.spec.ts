import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { AttendanceService } from './attendance.service';

describe('AttendanceService approval queue + coverage (IGDERP-283)', () => {
  let service: AttendanceService;
  let prisma: any;

  const dec = (n: number) => ({ toNumber: () => n });
  const rec = (employeeId: string) => ({
    id: `att-${employeeId}`,
    employeeId,
    date: new Date('2026-12-01T00:00:00Z'),
    status: 'present',
    totalHours: dec(8),
    overtimeHours: dec(0),
    employee: { id: employeeId, employeeCode: `EMP-${employeeId}` },
  });
  const emp = (id: string) => ({
    id,
    employeeCode: `EMP-${id}`,
    user: { fullName: `Name ${id}` },
    branch: null,
  });

  beforeEach(async () => {
    prisma = {
      employee: { findUnique: jest.fn(), findMany: jest.fn() },
      attendance: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      overtimeRequest: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AttendanceService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<AttendanceService>(AttendanceService);
  });

  const day = () => ({ start: new Date('2026-12-01T00:00:00Z'), end: new Date('2026-12-01T00:00:00Z') });

  describe('findAll single-day coverage', () => {
    it('appends not-clocked rows for employees without records', async () => {
      prisma.attendance.findMany.mockResolvedValue([rec('e1')]);
      prisma.employee.findMany.mockResolvedValue([emp('e1'), emp('e2')]);
      const { start, end } = day();
      const res: any = await service.findAll(undefined, undefined, start, end);
      expect(res.total).toBe(2);
      const missing = res.data.find((r: any) => r.employeeId === 'e2');
      expect(missing).toMatchObject({ status: 'not-clocked', id: 'missing-e2' });
      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
      );
    });

    it('returns only missing rows when status is not-clocked', async () => {
      prisma.attendance.findMany.mockResolvedValue([]);
      prisma.employee.findMany.mockResolvedValue([emp('e1')]);
      const { start, end } = day();
      const res: any = await service.findAll(undefined, undefined, start, end, undefined, 'not-clocked');
      expect(res.total).toBe(1);
      expect(res.data[0].status).toBe('not-clocked');
    });

    it('skips synthesis for employee-scoped or multi-day queries', async () => {
      prisma.attendance.findMany.mockResolvedValue([rec('e1')]);
      const { start } = day();
      const end2 = new Date('2026-12-03T00:00:00Z');
      const scoped: any = await service.findAll(undefined, 'e1', start, end2);
      expect(scoped.total).toBe(1);
      const multi: any = await service.findAll(undefined, undefined, start, end2);
      expect(multi.total).toBe(1);
      expect(prisma.employee.findMany).not.toHaveBeenCalled();
    });
  });

  describe('listOvertimeRequests', () => {
    it('filters by status and maps decimals', async () => {
      prisma.overtimeRequest.findMany.mockResolvedValue([
        { id: 'ot-1', status: 'pending', hours: dec(2), estimatedAmount: dec(50) },
      ]);
      const res: any = await service.listOvertimeRequests('pending');
      expect(prisma.overtimeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'pending' } }),
      );
      expect(res[0]).toMatchObject({ hours: 2, estimatedAmount: 50 });
    });

    it('lists all when status is empty', async () => {
      prisma.overtimeRequest.findMany.mockResolvedValue([]);
      await service.listOvertimeRequests(undefined);
      expect(prisma.overtimeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });
  });
});
