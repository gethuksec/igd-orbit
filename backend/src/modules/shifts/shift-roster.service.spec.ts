import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { ShiftRosterService } from './shift-roster.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('ShiftRosterService', () => {
  let service: ShiftRosterService;
  let prisma: any;
  const superadmin = { id: 'u-admin', roles: ['SUPERADMIN'] };
  const spv = { id: 'u-spv', roles: ['HS'] };

  const emp = (id: string, divisionId: string | null, departmentId = 'dept-1') => ({
    id,
    employeeCode: `EMP-${id}`,
    divisionId,
    departmentId,
    user: { fullName: `Name ${id}` },
    department: { id: departmentId, name: 'Produksi' },
    division: divisionId ? { id: divisionId, name: 'Produksi A' } : null,
  });

  const entry = (employeeId: string, date: string, shiftId: string | null, submitted = true) => ({
    employeeId,
    date: new Date(`${date}T00:00:00Z`),
    shiftId,
    submitted,
    shift: shiftId ? { id: shiftId, code: 'PAGI', name: 'Pagi' } : null,
  });

  beforeEach(async () => {
    prisma = {
      employee: { findUnique: jest.fn(), findMany: jest.fn() },
      shift: { findMany: jest.fn() },
      shiftRosterEntry: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
      $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShiftRosterService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ShiftRosterService>(ShiftRosterService);
  });

  const q = (over: any = {}) => ({ start: '2026-12-01', end: '2026-12-03', ...over });

  describe('getRoster', () => {
    it('marks TERJADWAL only on full submitted coverage', async () => {
      prisma.employee.findMany.mockResolvedValue([emp('e1', 'div-1'), emp('e2', 'div-1')]);
      prisma.shiftRosterEntry.findMany.mockResolvedValue([
        entry('e1', '2026-12-01', 'sh-1'),
        entry('e1', '2026-12-02', 'sh-1'),
        entry('e1', '2026-12-03', null),
        entry('e2', '2026-12-01', 'sh-1'),
      ]);
      const res: any = await service.getRoster(superadmin, q());
      const byId: any = Object.fromEntries(res.data.map((r: any) => [r.employee.id, r]));
      expect(byId.e1.status).toBe('TERJADWAL');
      expect(byId.e1.plotted).toBe(2);
      expect(byId.e1.libur).toBe(1);
      expect(byId.e1.dominantShift).toBe('PAGI');
      expect(byId.e2.status).toBe('BELUM');
      expect(byId.e2.empty).toBe(2);
    });

    it('unsubmitted entries do not count as TERJADWAL', async () => {
      prisma.employee.findMany.mockResolvedValue([emp('e1', 'div-1')]);
      prisma.shiftRosterEntry.findMany.mockResolvedValue([
        entry('e1', '2026-12-01', 'sh-1', false),
        entry('e1', '2026-12-02', 'sh-1', false),
        entry('e1', '2026-12-03', 'sh-1', false),
      ]);
      const res: any = await service.getRoster(superadmin, q());
      expect(res.data[0].status).toBe('BELUM');
    });

    it('forces division scope for non-superadmin and rejects dept filters', async () => {
      prisma.employee.findUnique.mockResolvedValue(emp('spv-1', 'div-9'));
      await expect(service.getRoster(spv, q({ departmentIds: 'dept-1' }))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      prisma.employee.findMany.mockResolvedValue([]);
      prisma.shiftRosterEntry.findMany.mockResolvedValue([]);
      await service.getRoster(spv, q());
      expect(prisma.employee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ divisionId: 'div-9' }) }),
      );
    });

    it('filters by status', async () => {
      prisma.employee.findMany.mockResolvedValue([emp('e1', 'div-1'), emp('e2', 'div-1')]);
      prisma.shiftRosterEntry.findMany.mockResolvedValue([
        entry('e1', '2026-12-01', 'sh-1'),
        entry('e1', '2026-12-02', 'sh-1'),
        entry('e1', '2026-12-03', null),
      ]);
      const res: any = await service.getRoster(superadmin, q({ status: 'BELUM' }));
      expect(res.data.map((r: any) => r.employee.id)).toEqual(['e2']);
      expect(res.meta.total).toBe(1);
    });
  });

  describe('getDivisionOverlay', () => {
    it('rejects scoped users outside their division', async () => {
      prisma.employee.findUnique.mockResolvedValue(emp('spv-1', 'div-9'));
      await expect(
        service.getDivisionOverlay(spv, { divisionId: 'div-1', start: '2026-12-01', end: '2026-12-03' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns teammates + entries for own division', async () => {
      prisma.employee.findUnique.mockResolvedValue(emp('spv-1', 'div-1'));
      prisma.employee.findMany.mockResolvedValue([emp('e1', 'div-1'), emp('e2', 'div-1')]);
      prisma.shiftRosterEntry.findMany.mockResolvedValue([entry('e1', '2026-12-01', 'sh-1')]);
      const res: any = await service.getDivisionOverlay(spv, {
        divisionId: 'div-1',
        start: '2026-12-01',
        end: '2026-12-03',
      });
      expect(res.employees).toHaveLength(2);
      expect(res.entries[0]).toMatchObject({ employeeId: 'e1', date: '2026-12-01', shiftCode: 'PAGI' });
    });
  });

  describe('getAssignContext', () => {
    it('rejects employees outside scope', async () => {
      prisma.employee.findUnique
        .mockResolvedValueOnce(emp('other', 'div-2')) // target
        .mockResolvedValueOnce(emp('spv-1', 'div-1')); // me
      await expect(service.getAssignContext(spv, 'other', '2026-12-01', '2026-12-03')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('submitRoster', () => {
    const fullEntries = [
      { date: '2026-12-01', shiftId: 'sh-1' },
      { date: '2026-12-02', shiftId: null },
      { date: '2026-12-03', shiftId: 'sh-1' },
    ];

    it('rejects partial ranges (all dates required)', async () => {
      prisma.employee.findUnique.mockResolvedValue(emp('e1', 'div-1'));
      await expect(
        service.submitRoster(superadmin, {
          employeeId: 'e1',
          start: '2026-12-01',
          end: '2026-12-03',
          entries: fullEntries.slice(0, 2),
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects unknown shifts', async () => {
      prisma.employee.findUnique.mockResolvedValue(emp('e1', 'div-1'));
      prisma.shift.findMany.mockResolvedValue([]);
      await expect(
        service.submitRoster(superadmin, {
          employeeId: 'e1',
          start: '2026-12-01',
          end: '2026-12-03',
          entries: fullEntries,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('replaces range entries and marks submitted', async () => {
      prisma.employee.findUnique.mockResolvedValue(emp('e1', 'div-1'));
      prisma.shift.findMany.mockResolvedValue([{ id: 'sh-1' }]);
      prisma.shiftRosterEntry.deleteMany.mockResolvedValue({ count: 1 });
      prisma.shiftRosterEntry.createMany.mockResolvedValue({ count: 3 });
      const res: any = await service.submitRoster(superadmin, {
        employeeId: 'e1',
        start: '2026-12-01',
        end: '2026-12-03',
        entries: fullEntries,
      });
      expect(res.submitted).toBe(3);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.shiftRosterEntry.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ employeeId: 'e1' }) }),
      );
    });
  });
});
