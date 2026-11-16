import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreateGradeDto } from '../dto/create-grade.dto';
import { UpdateGradeDto } from '../dto/update-grade.dto';
import { randomBytes } from 'crypto';

/**
 * Grades Service (IGDERP-277)
 * Staff-only tier ladder G1-G6. The salary band lives on Position.minSalary;
 * grade is the rung inside the title's band.
 */
@Injectable()
export class GradesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    const grades = await this.prisma.grade.findMany({
      where: { isActive: true },
      include: { _count: { select: { positions: true } } },
      orderBy: { rank: 'asc' },
    });
    return { data: grades, total: grades.length };
  }

  async findAllPaginated(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [grades, total] = await Promise.all([
      this.prisma.grade.findMany({
        where,
        skip,
        take: limit,
        include: { _count: { select: { positions: true } } },
        orderBy: { rank: 'asc' },
      }),
      this.prisma.grade.count({ where }),
    ]);
    return {
      data: grades,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const grade = await this.prisma.grade.findUnique({
      where: { id },
      include: {
        _count: { select: { positions: true } },
        positions: { select: { id: true, code: true, name: true }, take: 100 },
      },
    });
    if (!grade) {
      throw new NotFoundException('Grade not found');
    }
    return grade;
  }

  async create(dto: CreateGradeDto) {
    const code = dto.code ?? (await this.generateCode());
    const existing = await this.prisma.grade.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('Grade code already exists');
    }
    const rankTaken = await this.prisma.grade.findFirst({ where: { rank: dto.rank } });
    if (rankTaken) {
      throw new ConflictException(`Grade rank ${dto.rank} already taken by ${rankTaken.code}`);
    }
    return this.prisma.grade.create({
      data: {
        code,
        name: dto.name,
        rank: dto.rank,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateGradeDto) {
    const existing = await this.prisma.grade.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Grade not found');
    }
    if (dto.rank !== undefined && dto.rank !== existing.rank) {
      const rankTaken = await this.prisma.grade.findFirst({ where: { rank: dto.rank } });
      if (rankTaken && rankTaken.id !== id) {
        throw new ConflictException(`Grade rank ${dto.rank} already taken by ${rankTaken.code}`);
      }
    }
    return this.prisma.grade.update({
      where: { id },
      data: { name: dto.name, rank: dto.rank, isActive: dto.isActive },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.grade.findUnique({
      where: { id },
      include: { _count: { select: { positions: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Grade not found');
    }
    if (existing._count.positions > 0) {
      throw new BadRequestException(
        'Cannot deactivate grade with positions attached — move them first',
      );
    }
    await this.prisma.grade.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async generateCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = `GRD-${randomBytes(4).toString('hex').toUpperCase()}`;
      const existing = await this.prisma.grade.findUnique({ where: { code } });
      if (!existing) return code;
    }
    throw new BadRequestException('Failed to generate unique code after multiple attempts');
  }
}
