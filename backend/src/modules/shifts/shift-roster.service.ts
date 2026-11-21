import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { DivisionOverlayQueryDto, RosterQueryDto, SubmitRosterDto } from './dto';

export interface AuthedShiftUser {
  id: string;
  roles: string[];
}

const FULL_SCOPE_ROLES = ['SUPERADMIN', 'OWNER'];
const MAX_RANGE_DAYS = 62;

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

function dateList(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(last.getTime()) || cur > last) {
    throw new BadRequestException('Invalid date range');
  }
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
    if (out.length > MAX_RANGE_DAYS) throw new BadRequestException('Range too wide (max 62 days)');
  }
  return out;
}

const csv = (v?: string) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * ShiftRosterService — per-date roster plotting (WS-288 roster-first revamp).
 * Status: TERJADWAL = every date in range has a submitted entry; else BELUM.
 * Scope: SUPERADMIN/OWNER see all; everyone else sees their own division
 * (else department). Dept/division filters are superadmin-only.
 */
@Injectable()
export class ShiftRosterService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveScope(user: AuthedShiftUser) {
    if (user.roles?.some((r) => FULL_SCOPE_ROLES.includes(r))) return { all: true as const };
    const me = await this.prisma.employee.findUnique({ where: { userId: user.id } });
    if (!me) throw new ForbiddenException('No employee record for this user');
    if ((me as any).divisionId) return { all: false as const, divisionId: (me as any).divisionId };
    if ((me as any).departmentId) return { all: false as const, departmentId: (me as any).departmentId };
    return { all: false as const, employeeId: (me as any).id };
  }

  private async assertInScope(user: AuthedShiftUser, employeeId: string) {
    const target = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!target) throw new NotFoundException('Employee not found');
    const scope = await this.resolveScope(user);
    if (scope.all) return target;
    if ('divisionId' in scope && (target as any).divisionId === scope.divisionId) return target;
    if ('departmentId' in scope && (target as any).departmentId === scope.departmentId) return target;
    if ('employeeId' in scope && target.id === scope.employeeId) return target;
    throw new ForbiddenException('Employee outside your scope');
  }

  async getRoster(user: AuthedShiftUser, query: RosterQueryDto) {
    const days = dateList(query.start, query.end);
    const scope = await this.resolveScope(user);
    const deptIds = csv(query.departmentIds);
    const divIds = csv(query.divisionIds);
    if (!scope.all && (deptIds.length || divIds.length)) {
      throw new ForbiddenException('Department/division filters are superadmin-only');
    }

    const where: any = { isActive: true };
    if (scope.all) {
      if (deptIds.length) where.departmentId = { in: deptIds };
      if (divIds.length) where.divisionId = { in: divIds };
    } else if ('divisionId' in scope) {
      where.divisionId = scope.divisionId;
    } else if ('departmentId' in scope) {
      where.departmentId = scope.departmentId;
    } else if ('employeeId' in scope) {
      where.id = scope.employeeId;
    }
    if (query.search) {
      where.OR = [
        { employeeCode: { contains: query.search, mode: 'insensitive' } },
        { user: { fullName: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const employees = await this.prisma.employee.findMany({
      where,
      include: {
        user: { select: { fullName: true } },
        department: { select: { id: true, name: true } },
        division: { select: { id: true, name: true } },
      },
      orderBy: { employeeCode: 'asc' },
    });
    const ids = employees.map((e: any) => e.id);
    const entries = ids.length
      ? await this.prisma.shiftRosterEntry.findMany({
          where: {
            employeeId: { in: ids },
            date: { gte: new Date(query.start), lte: new Date(query.end) },
          },
          include: { shift: { select: { id: true, code: true, name: true } } },
        })
      : [];

    const byEmp = new Map<string, any[]>();
    for (const en of entries as any[]) {
      const k = en.employeeId;
      if (!byEmp.has(k)) byEmp.set(k, []);
      byEmp.get(k)!.push(en);
    }

    let rows = employees.map((emp: any) => {
      const list = byEmp.get(emp.id) ?? [];
      const byDate = new Map(list.map((en: any) => [isoDay(new Date(en.date)), en]));
      const missing = days.filter((d) => !byDate.has(d));
      const submittedFull = missing.length === 0 && list.every((en: any) => en.submitted);
      const plotted = list.filter((en: any) => en.shiftId);
      const libur = list.filter((en: any) => !en.shiftId);
      const freq = new Map<string, number>();
      for (const en of plotted) {
        const code = en.shift?.code ?? '?';
        freq.set(code, (freq.get(code) ?? 0) + 1);
      }
      const dominant = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        employee: {
          id: emp.id,
          employeeCode: emp.employeeCode,
          fullName: emp.user?.fullName ?? null,
          department: emp.department ?? null,
          division: emp.division ?? null,
        },
        status: submittedFull ? 'TERJADWAL' : 'BELUM',
        plotted: plotted.length,
        libur: libur.length,
        empty: missing.length,
        dominantShift: dominant,
      };
    });

    if (query.status && query.status !== 'ALL') {
      rows = rows.filter((r) => r.status === query.status);
    }
    const total = rows.length;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const data = rows.slice((page - 1) * limit, page * limit);
    return { data, meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } };
  }

  async getDivisionOverlay(user: AuthedShiftUser, query: DivisionOverlayQueryDto) {
    dateList(query.start, query.end); // validates range
    const scope = await this.resolveScope(user);
    if (!scope.all) {
      const ownDiv = 'divisionId' in scope ? scope.divisionId : null;
      if (ownDiv !== query.divisionId) throw new ForbiddenException('Division outside your scope');
    }
    const employees = await this.prisma.employee.findMany({
      where: { isActive: true, divisionId: query.divisionId },
      include: { user: { select: { fullName: true } } },
      orderBy: { employeeCode: 'asc' },
    });
    const ids = employees.map((e: any) => e.id);
    const entries = ids.length
      ? await this.prisma.shiftRosterEntry.findMany({
          where: {
            employeeId: { in: ids },
            date: { gte: new Date(query.start), lte: new Date(query.end) },
          },
          include: { shift: { select: { id: true, code: true, name: true } } },
        })
      : [];
    return {
      divisionId: query.divisionId,
      employees: employees.map((e: any) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        fullName: e.user?.fullName ?? null,
      })),
      entries: (entries as any[]).map((en: any) => ({
        employeeId: en.employeeId,
        date: isoDay(new Date(en.date)),
        shiftId: en.shiftId,
        shiftCode: en.shift?.code ?? null,
      })),
    };
  }

  async getAssignContext(user: AuthedShiftUser, employeeId: string, start: string, end: string) {
    const target = await this.assertInScope(user, employeeId);
    dateList(start, end);
    const entries = await this.prisma.shiftRosterEntry.findMany({
      where: { employeeId, date: { gte: new Date(start), lte: new Date(end) } },
      include: { shift: { select: { id: true, code: true, name: true } } },
      orderBy: { date: 'asc' },
    });
    const divisionId = (target as any).divisionId ?? null;
    const overlay = divisionId
      ? await this.getDivisionOverlay(user, { divisionId, start, end })
      : null;
    return {
      employee: target,
      entries: (entries as any[]).map((en: any) => ({
        date: isoDay(new Date(en.date)),
        shiftId: en.shiftId,
        shiftCode: en.shift?.code ?? null,
        submitted: en.submitted,
      })),
      overlay,
    };
  }

  async submitRoster(user: AuthedShiftUser, dto: SubmitRosterDto) {
    await this.assertInScope(user, dto.employeeId);
    const days = dateList(dto.start, dto.end);
    const got = new Set(dto.entries.map((e) => e.date));
    const missing = days.filter((d) => !got.has(d));
    if (missing.length) {
      throw new BadRequestException(`Semua tanggal wajib terisi (kosong: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` +${missing.length - 5}` : ''})`);
    }
    const shiftIds = [...new Set(dto.entries.map((e) => e.shiftId).filter(Boolean))] as string[];
    if (shiftIds.length) {
      const shifts = await this.prisma.shift.findMany({
        where: { id: { in: shiftIds }, isActive: true },
      });
      if (shifts.length !== shiftIds.length) throw new BadRequestException('Unknown or inactive shift');
    }
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.shiftRosterEntry.deleteMany({
        where: { employeeId: dto.employeeId, date: { gte: new Date(dto.start), lte: new Date(dto.end) } },
      }),
      this.prisma.shiftRosterEntry.createMany({
        data: dto.entries.map((e) => ({
          employeeId: dto.employeeId,
          date: new Date(e.date),
          shiftId: e.shiftId ?? null,
          submitted: true,
          submittedAt: now,
        })),
      }),
    ]);
    return { employeeId: dto.employeeId, submitted: days.length, start: dto.start, end: dto.end };
  }
}
