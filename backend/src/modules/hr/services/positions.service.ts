import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreatePositionDto } from '../dto/create-position.dto';
import { UpdatePositionDto } from '../dto/update-position.dto';
import { randomBytes } from 'crypto';

/**
 * Positions Service (IGDERP-277)
 * Job-title master — replaces Employee.position free text.
 * Staff titles (rank 6) carry a grade; L0-L5 titles never do.
 */
export const STAFF_RANK = 6;

@Injectable()
export class PositionsService {
  constructor(private prisma: PrismaService) {}

  private include = {
    division: { select: { id: true, code: true, name: true } },
    department: { select: { id: true, code: true, name: true } },
    parentPosition: { select: { id: true, code: true, name: true, rank: true } },
    grade: { select: { id: true, code: true, name: true, rank: true } },
    defaultRole: { select: { id: true, code: true, name: true } },
    defaultShift: { select: { id: true, code: true, name: true, clockIn: true, clockOut: true } },
    _count: { select: { employees: true } },
  };

  async findAll() {
    const positions = await this.prisma.position.findMany({
      where: { isActive: true },
      include: this.include,
      orderBy: [{ rank: 'asc' }, { name: 'asc' }],
    });
    return { data: positions, total: positions.length };
  }

  async findAllPaginated(page: number, limit: number, search?: string, rank?: number, includeInactive?: boolean) {
    const skip = (page - 1) * limit;
    const where: any = includeInactive ? {} : { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (rank !== undefined) {
      where.rank = rank;
    }
    const [positions, total] = await Promise.all([
      this.prisma.position.findMany({
        where,
        skip,
        take: limit,
        include: this.include,
        orderBy: [{ rank: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.position.count({ where }),
    ]);
    return {
      data: positions,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const position = await this.prisma.position.findUnique({
      where: { id },
      include: {
        ...this.include,
        employees: { select: { id: true, employeeCode: true }, take: 50 },
      },
    });
    if (!position) {
      throw new NotFoundException('Position not found');
    }
    return position;
  }

  /**
   * D4 — grades available for a position (IGDERP-301, N+1 revision).
   * Every title carries a grade (non-staff defaults to G1). Staff titles
   * (rank 6) expand to one row per grade (TITLE-G1..G6): the grade matrix
   * for the title family is the 6 active grades, and `positions` carries the
   * concrete row per rung so FE can remap positionId when the grade changes.
   * Non-staff titles are single rows — `grades` lists the 6 options and
   * `positions` is empty (no remap; the grade is stored on the same row).
   */
  async getGradesByPosition(positionId: string) {
    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
      include: {
        grade: { select: { id: true, code: true, name: true, rank: true } },
      },
    });
    if (!position) {
      throw new NotFoundException('Position not found');
    }
    if ((position as any).rank !== STAFF_RANK) {
      const grades = await this.prisma.grade.findMany({
        where: { isActive: true },
        orderBy: { rank: 'asc' },
      });
      return {
        positionId: (position as any).id,
        titleCode: (position as any).code,
        rank: (position as any).rank,
        gradeId: (position as any).gradeId ?? null,
        grades,
        positions: [],
      };
    }
    const titleCode = ((position as any).code as string).replace(/-\d+$/, '');
    const [family, grades] = await Promise.all([
      this.prisma.position.findMany({
        where: { code: { startsWith: `${titleCode}-` }, isActive: true },
        select: { id: true, code: true, gradeId: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.grade.findMany({
        where: { isActive: true },
        orderBy: { rank: 'asc' },
      }),
    ]);
    return {
      positionId: (position as any).id,
      titleCode,
      rank: (position as any).rank,
      gradeId: (position as any).gradeId ?? null,
      grades,
      positions: family,
    };
  }

  private assertGradeRule(rank: number, gradeId?: string | null) {
    if (rank === STAFF_RANK && !gradeId) {
      throw new BadRequestException('Staff positions (rank 6) require a grade');
    }
    // N+1 revision: every title carries a grade; non-staff defaults to G1
    // (defaulted in create/update when omitted). Explicit values are validated
    // by assertRefsExist.
  }

  /**
   * N+1 guard: parent must exist + be active, must not be self, must sit
   * higher (numerically smaller rank), and must not create a cycle.
   */
  private async assertParentRule(selfId: string | null, parentId: string | null | undefined, rank: number) {
    if (!parentId) return; // null = top of chain (MU) or unchanged on update
    if (selfId && parentId === selfId) {
      throw new BadRequestException('A position cannot be its own atasan (N+1)');
    }
    const parent = await this.prisma.position.findUnique({ where: { id: parentId } });
    if (!parent || !parent.isActive) {
      throw new BadRequestException('Parent position not found or inactive');
    }
    if (parent.rank >= rank) {
      throw new BadRequestException('Atasan (N+1) must sit higher than the title (smaller rank number)');
    }
    // Walk the ancestors; the chain must never loop back to self.
    const seen = new Set<string>();
    let cursor: string | null = parent.parentPositionId ?? null;
    for (let depth = 0; depth < 25 && cursor; depth++) {
      if (selfId && cursor === selfId) {
        throw new BadRequestException('Atasan (N+1) would create a reporting cycle');
      }
      if (seen.has(cursor)) break;
      seen.add(cursor);
      const next = await this.prisma.position.findUnique({
        where: { id: cursor },
        select: { parentPositionId: true },
      });
      cursor = (next?.parentPositionId as string | null) ?? null;
    }
  }

  /** Non-staff titles default to grade G1 when no grade is given. */
  private async defaultGradeId(): Promise<string | null> {
    const g1 = await this.prisma.grade.findUnique({ where: { code: 'G1' } });
    return g1 && g1.isActive ? g1.id : null;
  }

  private async assertRefsExist(dto: { divisionId?: string | null; departmentId?: string | null; gradeId?: string | null; defaultRoleId?: string | null; defaultShiftId?: string | null }) {
    if (dto.divisionId) {
      const division = await this.prisma.division.findUnique({ where: { id: dto.divisionId } });
      if (!division || !division.isActive) {
        throw new BadRequestException('Division not found or inactive');
      }
    }
    if (dto.departmentId) {
      const department = await this.prisma.department.findUnique({ where: { id: dto.departmentId } });
      if (!department || !department.isActive) {
        throw new BadRequestException('Department not found or inactive');
      }
    }
    if (dto.gradeId) {
      const grade = await this.prisma.grade.findUnique({ where: { id: dto.gradeId } });
      if (!grade || !grade.isActive) {
        throw new BadRequestException('Grade not found or inactive');
      }
    }
    if (dto.defaultRoleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.defaultRoleId } });
      if (!role || !role.isActive) {
        throw new BadRequestException('Role not found or inactive');
      }
    }
    if (dto.defaultShiftId) {
      const shift = await (this.prisma as any).shift.findFirst({
        where: { id: dto.defaultShiftId, deletedAt: null },
      });
      if (!shift) {
        throw new BadRequestException('Shift not found or inactive');
      }
    }
  }

  async create(dto: CreatePositionDto) {
    const code = dto.code ?? (await this.generateCode());
    const existing = await this.prisma.position.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('Position code already exists');
    }
    let gradeId = dto.gradeId ?? null;
    if (dto.rank !== STAFF_RANK && !gradeId) {
      gradeId = await this.defaultGradeId(); // non-staff defaults to G1
    }
    this.assertGradeRule(dto.rank, gradeId);
    await this.assertParentRule(null, (dto as any).parentPositionId, dto.rank);
    await this.assertRefsExist({ ...dto, gradeId });
    return this.prisma.position.create({
      data: {
        code,
        name: dto.name,
        rank: dto.rank,
        divisionId: dto.divisionId,
        departmentId: dto.departmentId,
        parentPositionId: (dto as any).parentPositionId ?? null,
        gradeId,
        minSalary: dto.minSalary ?? null,
        defaultRoleId: dto.defaultRoleId,
        defaultShiftId: (dto as any).defaultShiftId ?? null,
        isActive: dto.isActive ?? true,
      },
      include: this.include,
    });
  }

  async update(id: string, dto: UpdatePositionDto) {
    const existing = await this.prisma.position.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Position not found');
    }
    const rank = dto.rank ?? existing.rank;
    let gradeId = dto.gradeId !== undefined ? dto.gradeId : existing.gradeId;
    if (rank !== STAFF_RANK && !gradeId) {
      gradeId = await this.defaultGradeId(); // non-staff defaults to G1
    }
    this.assertGradeRule(rank, gradeId);
    const parentPositionId =
      (dto as any).parentPositionId !== undefined
        ? ((dto as any).parentPositionId as string | null)
        : undefined;
    await this.assertParentRule(id, parentPositionId, rank);
    await this.assertRefsExist({ ...dto, gradeId });
    return this.prisma.position.update({
      where: { id },
      data: {
        name: dto.name,
        rank: dto.rank,
        divisionId: dto.divisionId !== undefined ? dto.divisionId : undefined,
        departmentId: dto.departmentId !== undefined ? dto.departmentId : undefined,
        parentPositionId: parentPositionId !== undefined ? parentPositionId : undefined,
        gradeId: gradeId !== (existing as any).gradeId ? gradeId : undefined,
        minSalary: dto.minSalary !== undefined ? dto.minSalary : undefined,
        defaultRoleId: dto.defaultRoleId !== undefined ? dto.defaultRoleId : undefined,
        defaultShiftId: (dto as any).defaultShiftId !== undefined ? (dto as any).defaultShiftId : undefined,
        isActive: dto.isActive,
      },
      include: this.include,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.position.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Position not found');
    }
    if (existing._count.employees > 0) {
      throw new BadRequestException(
        'Cannot deactivate position with employees attached — move them first',
      );
    }
    const n1Children = await this.prisma.position.count({
      where: { parentPositionId: id, isActive: true },
    });
    if (n1Children > 0) {
      throw new BadRequestException(
        'Cannot deactivate position while it is the atasan (N+1) of other active titles — reassign their N+1 first',
      );
    }
    await this.prisma.position.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async generateCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = `POS-${randomBytes(4).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.position.findUnique({ where: { code } });
      if (!existing) return code;
    }
    throw new BadRequestException('Failed to generate unique code after multiple attempts');
  }
}
