import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { ShiftsService } from './shifts.service';

/**
 * IGDERP-265 gaps v2 (roster-first upstream): setting fallback, window-only
 * gate, roster-first shift resolution order.
 * (mocked prisma; mirrors the style of shifts.service.spec.ts)
 */
describe('ShiftsService gaps (IGDERP-265)', () => {
  let service: ShiftsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      shift: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn(), create: jest.fn(), update: jest.fn() },
      shiftSetting: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      shiftAssignment: { findMany: jest.fn() },
      shiftRosterEntry: { findFirst: jest.fn() },
      employee: { findUnique: jest.fn() },
      position: { findUnique: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShiftsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ShiftsService>(ShiftsService);
  });

  describe('getSetting — fallback', () => {
    it('returns defaults with configured:false when no row', async () => {
      prisma.shiftSetting.findFirst.mockResolvedValue(null);
      const res: any = await service.getSetting();
      expect(res).toMatchObject({ rosterOpenDay: 25, employeeInputStartDay: 25, configured: false });
      expect(res.requireRelease).toBeUndefined();
    });

    it('returns the stored row when present', async () => {
      prisma.shiftSetting.findFirst.mockResolvedValue({ rosterOpenDay: 20 });
      const res: any = await service.getSetting();
      expect(res.rosterOpenDay).toBe(20);
      expect(res.configured).toBeUndefined();
    });
  });

  describe('canEmployeeInput — Q4 window-only gate', () => {
    it('opens inside window (no release concept)', async () => {
      prisma.shiftSetting.findFirst.mockResolvedValue(null); // defaults: window opens 25th
      // period 2026-12 → window opens 25 Nov 2026
      const res: any = await service.canEmployeeInput('b1', '2026-12', new Date(2026, 10, 26));
      expect(res).toMatchObject({ open: true, reason: 'open' });
    });

    it('blocks before window start', async () => {
      prisma.shiftSetting.findFirst.mockResolvedValue(null);
      const res: any = await service.canEmployeeInput('b1', '2026-12', new Date(2026, 10, 20));
      expect(res).toMatchObject({ open: false, reason: 'outside-window' });
    });
  });

  describe('resolveShiftForDate — roster-first order', () => {
    const shift = { id: 's1', code: 'PAGI', clockIn: '08:00', deletedAt: null };
    const emp = (over: any = {}) => ({
      id: 'e1',
      position: { id: 'p1', rank: 6, defaultShiftId: 'sX' },
      defaultShift: null,
      ...over,
    });

    beforeEach(() => {
      prisma.shiftRosterEntry.findFirst.mockResolvedValue(null);
    });

    it('exempts L1-2 ranks', async () => {
      prisma.employee.findUnique.mockResolvedValue(
        emp({ position: { id: 'p1', rank: 1, defaultShiftId: 's1' } }),
      );
      const res: any = await service.resolveShiftForDate('e1', new Date(2026, 10, 26));
      expect(res).toMatchObject({ shift: null, source: 'exempt' });
    });

    it('prefers submitted roster entry over assignment', async () => {
      prisma.employee.findUnique.mockResolvedValue(emp());
      prisma.shiftRosterEntry.findFirst.mockResolvedValue({ shiftId: 's1', shift });
      prisma.shiftAssignment.findMany.mockResolvedValue([
        { shift: { ...shift, id: 's2', code: 'SIANG' }, weekdays: [4], offDates: [] },
      ]);
      const res: any = await service.resolveShiftForDate('e1', new Date(2026, 10, 26));
      expect(res).toMatchObject({ source: 'roster' });
      expect(res.shift.code).toBe('PAGI');
    });

    it('reports roster libur days (null shiftId)', async () => {
      prisma.employee.findUnique.mockResolvedValue(emp());
      prisma.shiftRosterEntry.findFirst.mockResolvedValue({ shiftId: null, shift: null });
      const res: any = await service.resolveShiftForDate('e1', new Date(2026, 10, 26));
      expect(res).toMatchObject({ shift: null, source: 'roster-libur' });
    });

    it('prefers assignment over defaults when no roster entry', async () => {
      prisma.employee.findUnique.mockResolvedValue(emp());
      prisma.shiftAssignment.findMany.mockResolvedValue([
        { shift, weekdays: [4], offDates: [] }, // 26 Nov 2026 = Thursday
      ]);
      const res: any = await service.resolveShiftForDate('e1', new Date(2026, 10, 26));
      expect(res).toMatchObject({ source: 'assignment' });
      expect(res.shift.code).toBe('PAGI');
    });

    it('falls back to title default when no assignment covers', async () => {
      prisma.employee.findUnique.mockResolvedValue(emp());
      prisma.shiftAssignment.findMany.mockResolvedValue([]);
      prisma.shift.findFirst.mockResolvedValue(shift);
      const res: any = await service.resolveShiftForDate('e1', new Date(2026, 10, 26));
      expect(res).toMatchObject({ source: 'title-default' });
    });

    it('returns none when nothing resolves', async () => {
      prisma.employee.findUnique.mockResolvedValue({ id: 'e1', position: null, defaultShift: null });
      prisma.shiftAssignment.findMany.mockResolvedValue([]);
      const res: any = await service.resolveShiftForDate('e1', new Date(2026, 10, 26));
      expect(res).toMatchObject({ shift: null, source: 'none' });
    });
  });
});
