import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../shared/services/prisma.service';
import { PasswordService } from '../../../shared/services/password.service';
import { CreateContractDto } from '../dto/create-contract.dto';
import { UpdateContractDto } from '../dto/update-contract.dto';
import { IntakeContractDto } from '../dto/intake-contract.dto';
import { randomBytes } from 'crypto';

/**
 * Contract stage caps (IGDERP-270, company pipeline — intentionally
 * non-statutory: trial → probation → PKWT → PKWTT).
 * Same-stage extension edits endDate; renewal / promotion / demotion /
 * rotation mint a NEW row with previousContractId (the chain is the career
 * history — history rows are never edited).
 */
export const CONTRACT_CAPS: Record<string, { maxCount: number; maxMonths: number | null }> = {
  trial: { maxCount: 1, maxMonths: 1 },
  probation: { maxCount: 2, maxMonths: 3 },
  pkwt: { maxCount: 2, maxMonths: 12 },
  pkwtt: { maxCount: 1, maxMonths: null },
};

const TERMINAL_STATUSES = ['expired', 'terminated', 'renewed'];

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/**
 * Tenure anchor (IGDERP-270): earliest startDate of the employee's UNBROKEN
 * contract chain. Renewals never reset the leave clock — only a real service
 * gap (next.startDate more than 1 day after prev.endDate) does. Falls back
 * to hireDate when the employee has no contracts yet.
 * Pure function over a prisma delegate so non-DI callers (leave) can reuse it.
 */
export async function resolveTenureAnchor(
  prisma: { contract?: { findMany(a: any): Promise<any[]> } },
  employeeId: string,
  fallbackHireDate: Date | null,
): Promise<Date | null> {
  const findMany = prisma?.contract?.findMany?.bind(prisma.contract);
  // Hand-rolled test doubles that predate the contracts table skip the chain
  // and fall back to hireDate; the real client always carries the delegate.
  if (!findMany) return fallbackHireDate;
  const chain = await findMany({
    where: { employeeId, status: { not: 'draft' } },
    orderBy: { startDate: 'desc' },
  });
  if (chain.length === 0) return fallbackHireDate;
  let anchor = new Date(chain[0].startDate);
  for (let i = 0; i < chain.length - 1; i++) {
    const newer = chain[i];
    const older = chain[i + 1];
    const newerStart = new Date(newer.startDate).getTime();
    const olderEnd = older.endDate ? new Date(older.endDate).getTime() : null;
    // Unbroken while the newer row starts at/before the older row ends (+1 day grace).
    if (olderEnd !== null && newerStart > olderEnd + 24 * 60 * 60 * 1000) break;
    anchor = new Date(older.startDate);
  }
  return anchor;
}

/** Is there an active contract covering today (login gate + badge)? */
export async function hasActiveContract(
  prisma: { contract: { findFirst(a: any): Promise<any> } },
  employeeId: string,
  at: Date = new Date(),
): Promise<boolean> {
  const found = await prisma.contract.findFirst({
    where: {
      employeeId,
      status: 'active',
      startDate: { lte: at },
      OR: [{ endDate: null }, { endDate: { gte: at } }],
    },
  });
  return !!found;
}

@Injectable()
export class ContractsService {
  constructor(
    private prisma: PrismaService,
    private passwordService: PasswordService,
  ) {}

  private include = {
    employee: { select: { id: true, userId: true, employeeCode: true } },
    contractWorkingLocations: {
      include: { workingLocation: { select: { id: true, code: true, name: true } } },
    },
    position: { select: { id: true, code: true, name: true } },
    grade: { select: { id: true, code: true, name: true } },
    division: { select: { id: true, code: true, name: true } },
    department: { select: { id: true, code: true, name: true } },
    contractBranches: {
      include: { branch: { select: { id: true, code: true, name: true } } },
    },
  };

  // ---------- reads ----------

  async findAll(filters: { page?: number; limit?: number; search?: string; type?: string; status?: string; employeeId?: string }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const where: any = {};
    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.search) {
      where.OR = [
        { contractNumber: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: this.include,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.prisma.contract.count({ where }),
    ]);
    return { data: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string) {
    const row = await this.prisma.contract.findUnique({
      where: { id },
      include: {
        ...this.include,
        previousContract: { select: { id: true, contractNumber: true, type: true, status: true } },
        nextContracts: { select: { id: true, contractNumber: true, type: true, status: true } },
      },
    });
    if (!row) throw new NotFoundException('Contract not found');
    return row;
  }

  /** Ordered stage chain for the timeline (EmployeeDetail). Oldest → newest. */
  async chainByEmployee(employeeId: string) {
    const rows = await this.prisma.contract.findMany({
      where: { employeeId },
      include: this.include,
      orderBy: [{ startDate: 'asc' }],
    });
    return { data: rows, total: rows.length };
  }

  async tenureAnchor(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    const anchor = await resolveTenureAnchor(this.prisma, employeeId, employee.hireDate ?? null);
    return { employeeId, tenureAnchor: anchor, hireDate: employee.hireDate ?? null };
  }

  /** Position.defaultRoleId suggestion for the intake role picker (admin can override). */
  async intakeSuggest(positionId: string) {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
      include: {
        defaultRole: { select: { id: true, code: true, name: true } },
        defaultShift: { select: { id: true, code: true, name: true, clockIn: true, clockOut: true } },
      },
    });
    if (!position) throw new NotFoundException('Position not found');
    return {
      positionId,
      suggestedRole: position.defaultRole ?? null,
      suggestedShift: (position as any).defaultShift ?? null,
    };
  }

  /**
   * IGDERP-265: resolve the shift to snapshot on a new contract — employee live
   * override wins, else the title (Position) default. Nulls when neither exists.
   */
  private async resolveShiftSnapshot(employeeId: string, positionId: string | null) {
    const db = this.prisma as any;
    let shiftId: string | null = null;
    const employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { defaultShiftId: true, positionId: true },
    });
    shiftId = employee?.defaultShiftId ?? null;
    if (!shiftId) {
      const posId = positionId ?? employee?.positionId ?? null;
      if (posId) {
        const position = await db.position.findUnique({
          where: { id: posId },
          select: { defaultShiftId: true },
        });
        shiftId = position?.defaultShiftId ?? null;
      }
    }
    if (!shiftId) {
      return { shiftId: null, shiftCode: null, shiftClockIn: null, shiftClockOut: null };
    }
    const shift = await db.shift.findFirst({ where: { id: shiftId, deletedAt: null } });
    if (!shift) {
      return { shiftId: null, shiftCode: null, shiftClockIn: null, shiftClockOut: null };
    }
    return {
      shiftId: shift.id,
      shiftCode: shift.code,
      shiftClockIn: shift.clockIn,
      shiftClockOut: shift.clockOut,
    };
  }

  // ---------- writes ----------

  private async monthsUsed(employeeId: string, type: string): Promise<{ count: number }> {
    const count = await this.prisma.contract.count({
      where: { employeeId, type, status: { not: 'draft' } },
    });
    return { count };
  }

  private async assertCaps(employeeId: string, type: string, startDate: Date, endDate: Date | null) {
    const cap = CONTRACT_CAPS[type];
    if (!cap) throw new BadRequestException(`Unknown contract type '${type}'`);
    const { count } = await this.monthsUsed(employeeId, type);
    if (count >= cap.maxCount) {
      throw new BadRequestException(
        `Contract cap reached: type '${type}' is limited to ${cap.maxCount}x per employee`,
      );
    }
    if (type === 'pkwtt') {
      if (endDate !== null) {
        throw new BadRequestException('PKWTT is permanent — end date must be empty');
      }
      return;
    }
    if (!endDate) {
      throw new BadRequestException(`End date is required for type '${type}'`);
    }
    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }
    if (cap.maxMonths !== null && monthsBetween(startDate, endDate) > cap.maxMonths) {
      throw new BadRequestException(
        `Contract duration exceeds the ${cap.maxMonths}-month cap for type '${type}'`,
      );
    }
  }

  private async assertRefs(dto: {
    employeeId: string;
    workingLocationIds?: string[];
    positionId?: string | null;
    gradeId?: string | null;
    divisionId?: string | null;
    departmentId?: string | null;
    previousContractId?: string | null;
    branchIds?: string[];
    primaryBranchId?: string | null;
  }) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new BadRequestException('Employee not found');
    const wlIds = dto.workingLocationIds ?? [];
    if (wlIds.length > 0) {
      const wls = await this.prisma.workingLocation.findMany({ where: { id: { in: wlIds } } });
      const found = new Set(wls.filter((w: any) => w.isActive).map((w: any) => w.id));
      const missing = wlIds.filter((id) => !found.has(id));
      if (missing.length > 0) throw new BadRequestException('Working location not found or inactive');
    }
    for (const [key, model] of [
      ['positionId', 'position'],
      ['gradeId', 'grade'],
      ['divisionId', 'division'],
      ['departmentId', 'department'],
    ] as const) {
      const id = (dto as any)[key] as string | null | undefined;
      if (id) {
        const ref = await (this.prisma as any)[model].findUnique({ where: { id } });
        if (!ref) throw new BadRequestException(`${key} not found`);
      }
    }
    if (dto.previousContractId) {
      const prev = await this.prisma.contract.findUnique({ where: { id: dto.previousContractId } });
      if (!prev) throw new BadRequestException('Previous contract not found');
      if (prev.employeeId !== dto.employeeId) {
        throw new BadRequestException('Previous contract belongs to a different employee');
      }
    }
    if (dto.branchIds && dto.branchIds.length > 0) {
      const branches = await this.prisma.branch.findMany({ where: { id: { in: dto.branchIds } } });
      const found = new Set(branches.filter((b) => b.isActive).map((b) => b.id));
      const missing = dto.branchIds.filter((id) => !found.has(id));
      if (missing.length > 0) {
        throw new BadRequestException('Branch not found or inactive');
      }
      if (dto.primaryBranchId && !dto.branchIds.includes(dto.primaryBranchId)) {
        throw new BadRequestException('Primary branch must be one of the assigned branches');
      }
    }
  }

  private async generateContractNumber(now: Date): Promise<string> {
    const prefix = `CTR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    for (let i = 0; i < 10; i++) {
      const num = `${prefix}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.contract.findUnique({ where: { contractNumber: num } });
      if (!existing) return num;
    }
    throw new ConflictException('Could not generate a unique contract number');
  }

  async create(dto: CreateContractDto, opts?: { deferCaps?: boolean }) {
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.probationEndDate && dto.type !== 'trial' && dto.type !== 'probation') {
      throw new BadRequestException('Probation end date only applies to trial/probation contracts');
    }
    if (dto.probationEndDate) {
      const pEnd = new Date(dto.probationEndDate);
      const capEnd = new Date(startDate);
      capEnd.setMonth(capEnd.getMonth() + 3);
      if (pEnd < startDate || pEnd > (endDate ?? capEnd)) {
        throw new BadRequestException('Probation end date must fall within the contract period');
      }
    }
    await this.assertRefs(dto);
    // IGDERP-299 (D1 anti-replace): a fresh row must not shadow an active
    // contract — renewals/promotions/adjustments link via previousContractId.
    if (!dto.previousContractId && (await hasActiveContract(this.prisma as any, dto.employeeId))) {
      throw new BadRequestException(
        'Karyawan sudah memiliki kontrak aktif — gunakan perpanjangan/penyesuaian (previous contract), bukan kontrak baru',
      );
    }
    // Import lands drafts with caps deferred — enforced at activation instead.
    if (!opts?.deferCaps) {
      await this.assertCaps(dto.employeeId, dto.type, startDate, endDate);
    }
    const manualNumber = dto.contractNumber?.trim() || null;
    if (manualNumber) {
      const taken = await this.prisma.contract.findUnique({ where: { contractNumber: manualNumber } });
      if (taken) throw new ConflictException(`Contract number ${manualNumber} is already used`);
    }
    const contractNumber = manualNumber ?? (await this.generateContractNumber(new Date()));
    // IGDERP-265: shift snapshot at signing — employee live override wins, else title default.
    const shiftSnapshot = await this.resolveShiftSnapshot(dto.employeeId, dto.positionId ?? null);
    const created = await this.prisma.contract.create({
      data: {
        contractNumber,
        employeeId: dto.employeeId,
        type: dto.type,
        startDate,
        endDate,
        probationEndDate: dto.probationEndDate ? new Date(dto.probationEndDate) : null,
        basicSalary: dto.basicSalary !== undefined ? new Decimal(dto.basicSalary) : null,
        positionId: dto.positionId ?? null,
        gradeId: dto.gradeId ?? null,
        divisionId: dto.divisionId ?? null,
        departmentId: dto.departmentId ?? null,
        ...shiftSnapshot,
        changeReason: dto.changeReason ?? (dto.previousContractId ? 'renewal' : 'initial'),
        status: dto.status ?? 'draft',
        previousContractId: dto.previousContractId ?? null,
        approvedBy: dto.approvedBy ?? null,
        ...(dto.workingLocationIds && dto.workingLocationIds.length > 0
          ? {
              contractWorkingLocations: {
                create: dto.workingLocationIds.map((workingLocationId) => ({
                  workingLocationId,
                })),
              },
            }
          : {}),
        ...(dto.branchIds && dto.branchIds.length > 0
          ? {
              contractBranches: {
                create: dto.branchIds.map((branchId) => ({
                  branchId,
                  isPrimary: dto.primaryBranchId ? branchId === dto.primaryBranchId : false,
                })),
              },
            }
          : {}),
      },
      include: this.include,
    });
    if (dto.previousContractId) {
      await this.prisma.contract.update({
        where: { id: dto.previousContractId },
        data: { status: 'renewed' },
      });
    }
    return created;
  }

  /**
   * Activation gate (IGDERP-271): draft → active requires a complete row
   * (≥1 working location, position, salary, ≥1 penempatan branch) and
   * passes the stage caps. Imports land incomplete drafts; HR completes
   * them here (draft-only ref edits) and activates.
   */
  private async assertActivationCompleteness(
    existing: any,
    dto: UpdateContractDto,
  ): Promise<{ workingLocationIds: string[]; branchIds: string[] }> {
    const workingLocationIds =
      dto.workingLocationIds ??
      (existing.contractWorkingLocations ?? []).map((c: any) => c.workingLocationId);
    const branchIds =
      dto.branchIds ?? (existing.contractBranches ?? []).map((c: any) => c.branchId);
    const positionId = dto.positionId !== undefined ? dto.positionId : existing.positionId;
    const gradeId = dto.gradeId !== undefined ? dto.gradeId : existing.gradeId;
    const basicSalary = dto.basicSalary !== undefined ? dto.basicSalary : existing.basicSalary;
    const missing: string[] = [];
    if (workingLocationIds.length === 0) missing.push('working locations');
    if (!positionId) missing.push('position');
    if (!gradeId) missing.push('grade');
    if (basicSalary === null || basicSalary === undefined) missing.push('basic salary');
    if (branchIds.length === 0) missing.push('penempatan (branches)');
    if (missing.length > 0) {
      throw new BadRequestException(`Cannot activate: incomplete — missing: ${missing.join(', ')}`);
    }
    const endDate =
      dto.endDate !== undefined
        ? dto.endDate
          ? new Date(dto.endDate)
          : null
        : existing.endDate
          ? new Date(existing.endDate)
          : null;
    await this.assertCaps(existing.employeeId, existing.type, new Date(existing.startDate), endDate);
    return { workingLocationIds, branchIds };
  }

  async update(id: string, dto: UpdateContractDto) {
    const existing = await this.findById(id);
    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new BadRequestException(`Contract is ${existing.status} — history rows are never edited`);
    }
    if (dto.status) {
      const from = existing.status;
      const allowed: Record<string, string[]> = {
        draft: ['active', 'terminated'],
        active: ['expired', 'terminated', 'renewed'],
      };
      if (!(allowed[from] ?? []).includes(dto.status)) {
        throw new BadRequestException(`Status transition ${from} → ${dto.status} is not allowed`);
      }
    }
    // Reference snapshots + assignments are draft-only edits — an active
    // contract changes via a new row (promotion / adjustment), never rewrite.
    const touchesRefs =
      dto.workingLocationIds !== undefined ||
      dto.branchIds !== undefined ||
      dto.primaryBranchId !== undefined ||
      dto.positionId !== undefined ||
      dto.gradeId !== undefined ||
      dto.divisionId !== undefined ||
      dto.departmentId !== undefined;
    if (touchesRefs && existing.status !== 'draft') {
      throw new BadRequestException(
        'Only drafts can edit references — mint a new row (promotion / adjustment) instead',
      );
    }
    if (touchesRefs) {
      await this.assertRefs({
        employeeId: existing.employeeId,
        workingLocationIds: dto.workingLocationIds,
        positionId: dto.positionId,
        gradeId: dto.gradeId,
        divisionId: dto.divisionId,
        departmentId: dto.departmentId,
        branchIds: dto.branchIds,
        primaryBranchId: dto.primaryBranchId ?? null,
      });
    }
    if (dto.endDate !== undefined) {
      // Same-stage extension: editing endDate keeps the cap check on the new span.
      const startDate = new Date(existing.startDate);
      const endDate = dto.endDate ? new Date(dto.endDate) : null;
      await this.assertCaps(existing.employeeId, existing.type, startDate, endDate);
    }

    const isActivation = dto.status === 'active' && existing.status === 'draft';
    if (isActivation) {
      await this.assertActivationCompleteness(existing, dto);
      // Chain-link at activation: previous = latest non-draft row at/before
      // this start; flip it to renewed only when it is still active.
      return this.prisma.$transaction(async (tx: any) => {
        if (dto.workingLocationIds !== undefined) {
          await tx.contractWorkingLocation.deleteMany({ where: { contractId: id } });
          if (dto.workingLocationIds.length > 0) {
            await tx.contractWorkingLocation.createMany({
              data: dto.workingLocationIds.map((workingLocationId) => ({
                contractId: id,
                workingLocationId,
              })),
            });
          }
        }
        if (dto.branchIds !== undefined) {
          await tx.contractBranch.deleteMany({ where: { contractId: id } });
          if (dto.branchIds.length > 0) {
            await tx.contractBranch.createMany({
              data: dto.branchIds.map((branchId) => ({
                contractId: id,
                branchId,
                isPrimary: dto.primaryBranchId ? branchId === dto.primaryBranchId : false,
              })),
            });
          }
        }
        const prev = await tx.contract.findFirst({
          where: {
            employeeId: existing.employeeId,
            id: { not: id },
            status: { not: 'draft' },
            startDate: { lte: new Date(existing.startDate) },
          },
          orderBy: { startDate: 'desc' },
        });
        const updated = await tx.contract.update({
          where: { id },
          data: {
            ...(dto.endDate !== undefined
              ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
              : {}),
            ...(dto.probationEndDate !== undefined
              ? { probationEndDate: dto.probationEndDate ? new Date(dto.probationEndDate) : null }
              : {}),
            status: 'active',
            ...(dto.approvedBy !== undefined ? { approvedBy: dto.approvedBy } : {}),
            ...(dto.basicSalary !== undefined
              ? { basicSalary: dto.basicSalary !== null ? new Decimal(dto.basicSalary) : null }
              : {}),
            ...(dto.positionId !== undefined ? { positionId: dto.positionId } : {}),
            ...(dto.gradeId !== undefined ? { gradeId: dto.gradeId } : {}),
            ...(dto.divisionId !== undefined ? { divisionId: dto.divisionId } : {}),
            ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
            previousContractId: prev?.id ?? null,
            changeReason: prev ? 'renewal' : 'initial',
          },
          include: this.include,
        });
        if (prev && prev.status === 'active') {
          await tx.contract.update({ where: { id: prev.id }, data: { status: 'renewed' } });
        }
        return updated;
      });
    }

    if (dto.workingLocationIds !== undefined || dto.branchIds !== undefined) {
      // Draft join replacement (non-activation edit).
      await this.prisma.$transaction(async (tx: any) => {
        if (dto.workingLocationIds !== undefined) {
          await tx.contractWorkingLocation.deleteMany({ where: { contractId: id } });
          if (dto.workingLocationIds.length > 0) {
            await tx.contractWorkingLocation.createMany({
              data: dto.workingLocationIds.map((workingLocationId) => ({
                contractId: id,
                workingLocationId,
              })),
            });
          }
        }
        if (dto.branchIds !== undefined) {
          await tx.contractBranch.deleteMany({ where: { contractId: id } });
          if (dto.branchIds.length > 0) {
            await tx.contractBranch.createMany({
              data: dto.branchIds.map((branchId) => ({
                contractId: id,
                branchId,
                isPrimary: dto.primaryBranchId ? branchId === dto.primaryBranchId : false,
              })),
            });
          }
        }
      });
    }
    return this.prisma.contract.update({
      where: { id },
      data: {
        ...(dto.endDate !== undefined
          ? { endDate: dto.endDate ? new Date(dto.endDate) : null }
          : {}),
        ...(dto.probationEndDate !== undefined
          ? { probationEndDate: dto.probationEndDate ? new Date(dto.probationEndDate) : null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.approvedBy !== undefined ? { approvedBy: dto.approvedBy } : {}),
        ...(dto.basicSalary !== undefined
          ? { basicSalary: dto.basicSalary !== null ? new Decimal(dto.basicSalary) : null }
          : {}),
        ...(dto.positionId !== undefined ? { positionId: dto.positionId } : {}),
        ...(dto.gradeId !== undefined ? { gradeId: dto.gradeId } : {}),
        ...(dto.divisionId !== undefined ? { divisionId: dto.divisionId } : {}),
        ...(dto.departmentId !== undefined ? { departmentId: dto.departmentId } : {}),
      },
      include: this.include,
    });
  }

  /** Drafts only — history rows are never deleted. */
  async remove(id: string) {
    const existing = await this.findById(id);
    if (existing.status !== 'draft') {
      throw new BadRequestException('Only draft contracts can be deleted');
    }
    await this.prisma.contract.delete({ where: { id } });
  }

  /**
   * Single HR intake (IGDERP-270): writes the User + Employee + first
   * Contract + ContractBranch rows + UserBranch access rows in ONE
   * transaction. UserBranch stays editable afterwards; the contract row is
   * never rewritten by access edits. Position.defaultRoleId suggests the
   * role — admin can override inline via roleId.
   */
  async intake(dto: IntakeContractDto) {
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.probationEndDate && dto.type !== 'trial' && dto.type !== 'probation') {
      throw new BadRequestException('Probation end date only applies to trial/probation contracts');
    }
    const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingEmail) throw new ConflictException('Email already registered');
    if (dto.username) {
      const existingUsername = await this.prisma.user.findUnique({ where: { username: dto.username } });
      if (existingUsername) throw new ConflictException('Username already taken');
    }
    const pwCheck = this.passwordService.validatePasswordStrength(dto.password);
    if (!pwCheck.isValid) throw new BadRequestException(pwCheck.error);
    if (dto.workingLocationIds && dto.workingLocationIds.length > 0) {
      const wls = await this.prisma.workingLocation.findMany({
        where: { id: { in: dto.workingLocationIds } },
      });
      const found = new Set(wls.filter((w) => w.isActive).map((w) => w.id));
      if (dto.workingLocationIds.some((id) => !found.has(id))) {
        throw new BadRequestException('Working location not found or inactive');
      }
    }
    let roleId = dto.roleId ?? null;
    if (dto.positionId) {
      const position = await this.prisma.position.findUnique({ where: { id: dto.positionId } });
      if (!position || !position.isActive) throw new BadRequestException('Position not found or inactive');
      roleId = roleId ?? position.defaultRoleId ?? null;
      if (dto.divisionId && position.divisionId && dto.divisionId !== position.divisionId) {
        throw new BadRequestException('Division does not match the position');
      }
    }
    if (!roleId) throw new BadRequestException('Role is required (position has no suggested role)');
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role || !role.isActive) throw new BadRequestException('Role not found or inactive');
    const branchIds = dto.branchIds ?? [];
    if (branchIds.length > 0) {
      const branches = await this.prisma.branch.findMany({ where: { id: { in: branchIds } } });
      const found = new Set(branches.filter((b) => b.isActive).map((b) => b.id));
      if (branchIds.some((id) => !found.has(id))) {
        throw new BadRequestException('Branch not found or inactive');
      }
    }
    // Stage caps apply to the first row too (trial 1x, probation 2x, ...).
    // No prior rows exist for a new employee, but the duration check still runs.
    const cap = CONTRACT_CAPS[dto.type];
    if (!cap) throw new BadRequestException(`Unknown contract type '${dto.type}'`);
    if (dto.type === 'pkwtt' && endDate !== null) {
      throw new BadRequestException('PKWTT is permanent — end date must be empty');
    }
    if (dto.type !== 'pkwtt') {
      if (!endDate) throw new BadRequestException(`End date is required for type '${dto.type}'`);
      if (endDate <= startDate) throw new BadRequestException('End date must be after start date');
      if (cap.maxMonths !== null && monthsBetween(startDate, endDate) > cap.maxMonths) {
        throw new BadRequestException(
          `Contract duration exceeds the ${cap.maxMonths}-month cap for type '${dto.type}'`,
        );
      }
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);
    const contractNumber = await this.generateContractNumber(new Date());
    const lastEmployee = await this.prisma.employee.findFirst({
      orderBy: { employeeCode: 'desc' },
      where: { employeeCode: { startsWith: 'EMP-' } },
    });
    const employeeCode = lastEmployee
      ? `EMP-${String(parseInt(lastEmployee.employeeCode.replace('EMP-', ''), 10) + 1).padStart(4, '0')}`
      : 'EMP-0001';

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          username: dto.username,
          passwordHash,
          fullName: dto.fullName,
          phone: dto.phone,
          isActive: true,
          isVerified: false,
        },
      });
      const primaryBranchId = dto.primaryBranchId ?? branchIds[0] ?? null;
      await tx.employee.create({
        data: {
          userId: user.id,
          employeeCode,
          branchId: primaryBranchId,
          departmentId: dto.departmentId ?? null,
          divisionId: dto.divisionId ?? null,
          positionId: dto.positionId ?? null,
          hireDate: startDate,
          basicSalary: dto.basicSalary !== undefined ? new Decimal(dto.basicSalary) : null,
          isActive: true,
        },
      });
      const employee = await tx.employee.findUniqueOrThrow({ where: { userId: user.id } });
      await tx.contract.create({
        data: {
          contractNumber,
          employeeId: employee.id,
          type: dto.type,
          startDate,
          endDate,
          probationEndDate: dto.probationEndDate ? new Date(dto.probationEndDate) : null,
          basicSalary: dto.basicSalary !== undefined ? new Decimal(dto.basicSalary) : null,
          positionId: dto.positionId ?? null,
          gradeId: dto.gradeId ?? null,
          divisionId: dto.divisionId ?? null,
          departmentId: dto.departmentId ?? null,
          changeReason: 'initial',
          status: dto.status ?? 'active',
          contractWorkingLocations:
            dto.workingLocationIds && dto.workingLocationIds.length > 0
              ? {
                  create: dto.workingLocationIds.map((workingLocationId) => ({
                    workingLocationId,
                  })),
                }
              : undefined,
          contractBranches:
            branchIds.length > 0
              ? {
                  create: branchIds.map((branchId) => ({
                    branchId,
                    isPrimary: branchId === primaryBranchId,
                  })),
                }
              : undefined,
        },
      });
      for (const branchId of branchIds) {
        await tx.userBranch.create({
          data: {
            userId: user.id,
            roleId,
            branchId,
            isPrimary: branchId === primaryBranchId,
          },
        });
      }
      return tx.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { employee: true, userBranches: { include: { role: true, branch: true } } },
      });
    });
  }

  /**
   * Import-as-intake row (IGDERP-298): writes the User (server-generated
   * password hash, mustChangePassword=true) + Employee (employeeCode = NIP,
   * education snapshot) + first Contract (draft) + ContractBranch rows in
   * ONE transaction. Caps are deferred to activation like the draft import.
   * Unlike single intake the role is optional — without a suggested role
   * (or branches) the UserBranch access rows are skipped and reported via
   * `accessNote`; HR provisions access via the user menu.
   */
  async intakeFromImport(dto: {
    fullName: string;
    email: string;
    phone?: string | null;
    employeeCode: string;
    education?: string | null;
    type: string;
    startDate: string;
    endDate?: string | null;
    positionId?: string | null;
    gradeId?: string | null;
    divisionId?: string | null;
    departmentId?: string | null;
    branchIds: string[];
    primaryBranchId?: string | null;
    basicSalary?: number | null;
    passwordHash: string;
  }): Promise<{ contractNumber: string; employeeId: string; userId: string; accessNote?: string }> {
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    const cap = CONTRACT_CAPS[dto.type];
    if (!cap) throw new BadRequestException(`Unknown contract type '${dto.type}'`);
    if (dto.type === 'pkwtt' && endDate !== null) {
      throw new BadRequestException('PKWTT is permanent — end date must be empty');
    }
    if (dto.type !== 'pkwtt') {
      if (!endDate) throw new BadRequestException(`End date is required for type '${dto.type}'`);
      if (endDate <= startDate) throw new BadRequestException('End date must be after start date');
    }
    const takenEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (takenEmail) throw new ConflictException('Email already registered');
    const takenCode = await this.prisma.employee.findUnique({ where: { employeeCode: dto.employeeCode } });
    if (takenCode) throw new ConflictException(`NIP ${dto.employeeCode} sudah terdaftar`);
    let roleId: string | null = null;
    if (dto.positionId) {
      const position = await this.prisma.position.findUnique({ where: { id: dto.positionId } });
      if (!position || !(position as any).isActive) throw new BadRequestException('Position not found or inactive');
      roleId = ((position as any).defaultRoleId as string | null) ?? null;
    }
    const branchIds = dto.branchIds ?? [];
    if (branchIds.length > 0) {
      const branches = await this.prisma.branch.findMany({ where: { id: { in: branchIds } } });
      const found = new Set(branches.filter((b) => (b as any).isActive).map((b) => (b as any).id));
      if (branchIds.some((id) => !found.has(id))) {
        throw new BadRequestException('Branch not found or inactive');
      }
    }
    const contractNumber = await this.generateContractNumber(new Date());
    const primaryBranchId = dto.primaryBranchId ?? branchIds[0] ?? null;
    const out = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          phone: dto.phone ?? null,
          passwordHash: dto.passwordHash,
          fullName: dto.fullName,
          mustChangePassword: true,
          isActive: true,
          isVerified: false,
        },
      });
      await tx.employee.create({
        data: {
          userId: user.id,
          employeeCode: dto.employeeCode,
          branchId: primaryBranchId,
          departmentId: dto.departmentId ?? null,
          divisionId: dto.divisionId ?? null,
          positionId: dto.positionId ?? null,
          hireDate: startDate,
          basicSalary: dto.basicSalary !== undefined && dto.basicSalary !== null ? new Decimal(dto.basicSalary) : null,
          education: dto.education ?? null,
          isActive: true,
        },
      });
      const employee = await tx.employee.findUniqueOrThrow({ where: { userId: user.id } });
      await tx.contract.create({
        data: {
          contractNumber,
          employeeId: employee.id,
          type: dto.type,
          startDate,
          endDate,
          basicSalary: dto.basicSalary !== undefined && dto.basicSalary !== null ? new Decimal(dto.basicSalary) : null,
          positionId: dto.positionId ?? null,
          gradeId: dto.gradeId ?? null,
          divisionId: dto.divisionId ?? null,
          departmentId: dto.departmentId ?? null,
          changeReason: 'initial',
          status: 'draft',
          contractBranches:
            branchIds.length > 0
              ? {
                  create: branchIds.map((branchId) => ({
                    branchId,
                    isPrimary: branchId === primaryBranchId,
                  })),
                }
              : undefined,
        },
      });
      let accessNote: string | undefined;
      if (roleId && branchIds.length > 0) {
        for (const branchId of branchIds) {
          await tx.userBranch.create({
            data: { userId: user.id, roleId, branchId, isPrimary: branchId === primaryBranchId },
          });
        }
      } else {
        accessNote = 'Akses outlet belum dibuat (role/penempatan belum lengkap) — lengkapi via menu user';
      }
      return { contractNumber, employeeId: employee.id, userId: user.id, accessNote };
    });
    return out;
  }
}
