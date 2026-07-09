
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateUnitDto, UpdateUnitDto, ListUnitsDto } from './dto';
import { randomBytes } from 'crypto';

@Injectable()
export class UnitsService {
  constructor(private prisma: PrismaService) {}
  async generateCode(): Promise<string> {
    let code: string; let isUnique = false; let attempts = 0;
    while (!isUnique && attempts < 10) {
      code = 'UNT-' + randomBytes(4).toString('hex').toUpperCase();
      if (!(await this.prisma.unit.findUnique({ where: { code } }))) isUnique = true;
      attempts++;
    }
    if (!isUnique) throw new BadRequestException('Failed to generate unique code');
    return code!;
  }
  async findAll(query: ListUnitsDto) {
    const pageNum = +(query.page || 1), limitNum = +(query.limit || 20);
    const where: any = { isActive: true };
    if (query.search) where.OR = [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }];
    const [items, total] = await Promise.all([
      this.prisma.unit.findMany({ where, skip: (pageNum - 1) * limitNum, take: limitNum, orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } }),
      this.prisma.unit.count({ where }),
    ]);
    return { data: items.map((item: any) => ({ id: item.id, code: item.code, name: item.name, productCount: item._count.products, isActive: item.isActive, createdAt: item.createdAt, updatedAt: item.updatedAt })), meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } };
  }
  async findById(id: string) {
    const item = await this.prisma.unit.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
    if (!item) throw new NotFoundException('Unit not found');
    return { id: item.id, code: item.code, name: item.name, productCount: item._count.products, isActive: item.isActive, createdAt: item.createdAt, updatedAt: item.updatedAt };
  }
  async create(dto: CreateUnitDto) {
    let code = dto.code || await this.generateCode();
    if (dto.code) { const e = await this.prisma.unit.findUnique({ where: { code } }); if (e) throw new ConflictException('Code already exists'); }
    const e = await this.prisma.unit.findFirst({ where: { name: dto.name, isActive: true } }); if (e) throw new ConflictException('Name must be unique');
    const item = await this.prisma.unit.create({ data: { code, name: dto.name, isActive: true }, include: { _count: { select: { products: true } } } });
    return { id: item.id, code: item.code, name: item.name, productCount: item._count.products, isActive: item.isActive, createdAt: item.createdAt, updatedAt: item.updatedAt };
  }
  async update(id: string, dto: UpdateUnitDto) {
    const item = await this.prisma.unit.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Unit not found');
    if (dto.name && dto.name !== item.name) { const e = await this.prisma.unit.findFirst({ where: { name: dto.name, isActive: true, id: { not: id } } }); if (e) throw new ConflictException('Name must be unique'); }
    if (dto.code && dto.code !== item.code) { const e = await this.prisma.unit.findUnique({ where: { code: dto.code } }); if (e) throw new ConflictException('Code already exists'); }
    const ud: any = {};
    if (dto.name !== undefined) ud.name = dto.name;
    if (dto.code !== undefined) ud.code = dto.code;
    const updated = await this.prisma.unit.update({ where: { id }, data: ud, include: { _count: { select: { products: true } } } });
    return { id: updated.id, code: updated.code, name: updated.name, productCount: updated._count.products, isActive: updated.isActive, createdAt: updated.createdAt, updatedAt: updated.updatedAt };
  }
  async delete(id: string): Promise<void> {
    const item = await this.prisma.unit.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
    if (!item) throw new NotFoundException('Unit not found');
    if (item._count.products > 0) throw new BadRequestException('Cannot delete unit with ' + item._count.products + ' product(s)');
    await this.prisma.unit.update({ where: { id }, data: { isActive: false } });
  }
}

