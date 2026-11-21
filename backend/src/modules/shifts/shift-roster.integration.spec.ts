import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { ShiftRosterService } from './shift-roster.service';
import { BadRequestException } from '@nestjs/common';

/**
 * ShiftRosterService integration — roster rules through an in-memory fake.
 * Status derivation, scope forcing, full-range submit validation, resubmit.
 */
describe('ShiftRosterService integration — roster rules', () => {
  let service: ShiftRosterService;
  let prisma: any;

  const employees: any[] = [];
  const entries: any[] = [];
  const approvals: any[] = [];

  const iso = (d: any) => new Date(d).toISOString().slice(0, 10);

  beforeEach(async () => {
    employees.length = 0;
    entries.length = 0;
    approvals.length = 0;
    employees.push(
      { id: 'e1', userId: 'u1', employeeCode: 'EMP-001', isActive: true, departmentId: 'dept-1', divisionId: 'div-1', user: { fullName: 'Andini' }, department: { id: 'dept-1', name: 'Produksi' }, division: { id: 'div-1', name: 'Produksi A' } },
      { id: 'e2', userId: 'u2', employeeCode: 'EMP-002', isActive: true, departmentId: 'dept-1', divisionId: 'div-1', user: { fullName: 'Budi' }, department: { id: 'dept-1', name: 'Produksi' }, division: { id: 'div-1', name: 'Produksi A' } },
      { id: 'spv', userId: 'u-spv', employeeCode: 'EMP-900', isActive: true, departmentId: 'dept-1', divisionId: 'div-1', user: { fullName: 'Spv' }, department: { id: 'dept-1', name: 'Produksi' }, division: { id: 'div-1', name: 'Produksi A' } },
    );
    // e1: full submitted December 1-3 (Pagi, Pagi, Libur)
    for (const [date, shiftId] of [['2026-12-01', 'sh-1'], ['2026-12-02', 'sh-1'], ['2026-12-03', null]]) {
      entries.push({ employeeId: 'e1', date: new Date(`${date}T00:00:00Z`), shiftId, submitted: true, shift: shiftId ? { id: 'sh-1', code: 'PAGI', name: 'Pagi' } : null });
    }
    // e2: only Dec 1 submitted
    entries.push({ employeeId: 'e2', date: new Date('2026-12-01T00:00:00Z'), shiftId: 'sh-1', submitted: true, shift: { id: 'sh-1', code: 'PAGI', name: 'Pagi' } });
    // e2 has an approved libur request for Dec 2 (roster libur-day = approved request)
    approvals.push({ employeeId: 'e2', date: new Date('2026-12-02T00:00:00Z'), status: 'approved' });

    prisma = {
      employee: {
        findUnique: jest.fn(async ({ where }: any) =>
          employees.find((e) => (where.id && e.id === where.id) || (where.userId && e.userId === where.userId)) ?? null,
        ),
        findMany: jest.fn(async ({ where }: any = {}) => {
          let out = employees.filter((e) => e.isActive);
          if (where.id) out = out.filter((e) => e.id === where.id);
          if (where.divisionId) out = out.filter((e) => e.divisionId === (where.divisionId?.in ? where.divisionId.in[0] && where.divisionId.in.includes(e.divisionId) : where.divisionId));
          if (where.departmentId) {
            const dep = typeof where.departmentId === 'string' ? where.departmentId : where.departmentId?.in?.[0];
            out = out.filter((e) => (where.departmentId?.in ? where.departmentId.in.includes(e.departmentId) : e.departmentId === dep));
          }
          if (where.OR) {
            out = out.filter((e) => where.OR.some((c: any) => (c.employeeCode && e.employeeCode.includes(c.employeeCode.contains)) || (c.user?.fullName && e.user.fullName.includes(c.user.fullName.contains))));
          }
          return out;
        }),
      },
      shift: { findMany: jest.fn(async () => [{ id: 'sh-1' }]) },
      liburRequest: {
        findMany: jest.fn(async ({ where }: any = {}) => {
          let out = approvals.slice();
          if (where.employeeId) out = out.filter((r) => r.employeeId === where.employeeId);
          if (where.status) out = out.filter((r) => r.status === where.status);
          return out;
        }),
      },
      shiftRosterEntry: {
        findMany: jest.fn(async ({ where }: any = {}) => {
          let out = entries.slice();
          if (where.employeeId?.in) out = out.filter((en) => where.employeeId.in.includes(en.employeeId));
          if (where.employeeId && typeof where.employeeId === 'string') out = out.filter((en) => en.employeeId === where.employeeId);
          if (where.date) {
            out = out.filter((en) => {
              const d = iso(en.date);
              return (!where.date.gte || d >= iso(where.date.gte)) && (!where.date.lte || d <= iso(where.date.lte));
            });
          }
          return out;
        }),
        deleteMany: jest.fn(async ({ where }: any) => {
          const before = entries.length;
          for (let i = entries.length - 1; i >= 0; i--) {
            const en = entries[i];
            const d = iso(en.date);
            if (en.employeeId === where.employeeId && d >= iso(where.date.gte) && d <= iso(where.date.lte)) entries.splice(i, 1);
          }
          return { count: before - entries.length };
        }),
        createMany: jest.fn(async ({ data }: any) => {
          for (const r of data) entries.push({ ...r, shift: r.shiftId ? { id: r.shiftId, code: 'PAGI', name: 'Pagi' } : null });
          return { count: data.length };
        }),
      },
      $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShiftRosterService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ShiftRosterService>(ShiftRosterService);
  });

  const admin = { id: 'u-admin', roles: ['SUPERADMIN'] };
  const spvUser = { id: 'u-spv', roles: ['HS'] };

  it('derives TERJADWAL/BELUM + counts end-to-end', async () => {
    const res: any = await service.getRoster(admin, { start: '2026-12-01', end: '2026-12-03' } as any);
    const byId: any = Object.fromEntries(res.data.map((r: any) => [r.employee.id, r]));
    expect(byId.e1.status).toBe('TERJADWAL');
    expect(byId.e1).toMatchObject({ plotted: 2, libur: 1, empty: 0, dominantShift: 'PAGI' });
    expect(byId.e2.status).toBe('BELUM');
    expect(byId.e2.empty).toBe(2);
  });

  it('scoped user sees own division without filters', async () => {
    const res: any = await service.getRoster(spvUser, { start: '2026-12-01', end: '2026-12-03' } as any);
    expect(res.meta.total).toBe(3);
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ divisionId: 'div-1' }) }),
    );
  });

  it('submit fills gaps and flips BELUM to TERJADWAL (resubmit allowed)', async () => {
    const dto: any = {
      employeeId: 'e2',
      start: '2026-12-01',
      end: '2026-12-03',
      entries: [
        { date: '2026-12-01', shiftId: 'sh-1' },
        { date: '2026-12-02', shiftId: null },
        { date: '2026-12-03', shiftId: 'sh-1' },
      ],
    };
    const out: any = await service.submitRoster(admin, dto);
    expect(out.submitted).toBe(3);
    const res: any = await service.getRoster(admin, { start: '2026-12-01', end: '2026-12-03' } as any);
    expect(Object.fromEntries(res.data.map((r: any) => [r.employee.id, r])).e2.status).toBe('TERJADWAL');
  });

  it('submit rejects libur days without an approved request', async () => {
    await expect(
      service.submitRoster(admin, {
        employeeId: 'e1',
        start: '2026-12-01',
        end: '2026-12-03',
        entries: [
          { date: '2026-12-01', shiftId: 'sh-1' },
          { date: '2026-12-02', shiftId: null }, // e1 has no approval
          { date: '2026-12-03', shiftId: 'sh-1' },
        ],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('submit rejects partial ranges', async () => {
    await expect(
      service.submitRoster(admin, {
        employeeId: 'e2',
        start: '2026-12-01',
        end: '2026-12-03',
        entries: [{ date: '2026-12-01', shiftId: 'sh-1' }],
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
