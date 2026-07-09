
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateSizeDto, UpdateSizeDto, ListSizesDto } from './dto';
import { randomBytes } from 'crypto';

@Injectable()
export class SizesService {
  constructor(private prisma: PrismaService) {}
  async generateCode(): Promise<string> {
    let code: string; let isUnique = false; let attempts = 0;
    while (!isUnique && attempts < 10) {
      code = 'SIZ-' + randomBytes(4).toString('hex').toUpperCase();
      if (!(await this.prisma.size.findUnique({ where: { code } }))) isUnique = true;
      attempts++;
    }
    if (!isUnique) throw new BadRequestException('Failed to generate unique code');
    return code!;
  }
  async findAll(query: ListSizesDto) {
    const pageNum = +(query.page || 1), limitNum = +(query.limit || 20);
    const where: any = { isActive: true };
    if (query.search) where.OR = [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }];
    const [items, total] = await Promise.all([
      this.prisma.size.findMany({ where, skip: (pageNum - 1) * limitNum, take: limitNum, orderBy: { name: 'asc' }, include: { _count: { select: { products: true } } } }),
      this.prisma.size.count({ where }),
    ]);
    return { data: items.map((item: any) => ({ id: item.id, code: item.code, name: item.name, productCount: item._count.products, isActive: item.isActive, createdAt: item.createdAt, updatedAt: item.updatedAt })), meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } };
  }
  async findById(id: string) {
    const item = await this.prisma.size.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
    if (!item) throw new NotFoundException('Size not found');
    return { id: item.id, code: item.code, name: item.name, productCount: item._count.products, isActive: item.isActive, createdAt: item.createdAt, updatedAt: item.updatedAt };
  }
  async create(dto: CreateSizeDto) {
    let code = dto.code || await this.generateCode();
    if (dto.code) { const e = await this.prisma.size.findUnique({ where: { code } }); if (e) throw new ConflictException('Code already exists'); }
    const e = await this.prisma.size.findFirst({ where: { name: dto.name, isActive: true } }); if (e) throw new ConflictException('Name must be unique');
    const item = await this.prisma.size.create({ data: { code, name: dto.name, isActive: true }, include: { _count: { select: { products: true } } } });
    return { id: item.id, code: item.code, name: item.name, productCount: item._count.products, isActive: item.isActive, createdAt: item.createdAt, updatedAt: item.updatedAt };
  }
  async update(id: string, dto: UpdateSizeDto) {
    const item = await this.prisma.size.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Size not found');
    if (dto.name && dto.name !== item.name) { const e = await this.prisma.size.findFirst({ where: { name: dto.name, isActive: true, id: { not: id } } }); if (e) throw new ConflictException('Name must be unique'); }
    if (dto.code && dto.code !== item.code) { const e = await this.prisma.size.findUnique({ where: { code: dto.code } }); if (e) throw new ConflictException('Code already exists'); }
    const ud: any = {};
    if (dto.name !== undefined) ud.name = dto.name;
    if (dto.code !== undefined) ud.code = dto.code;
    const updated = await this.prisma.size.update({ where: { id }, data: ud, include: { _count: { select: { products: true } } } });
    return { id: updated.id, code: updated.code, name: updated.name, productCount: updated._count.products, isActive: updated.isActive, createdAt: updated.createdAt, updatedAt: updated.updatedAt };
  }
  async delete(id: string): Promise<void> {
    const item = await this.prisma.size.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
    if (!item) throw new NotFoundException('Size not found');
    if (item._count.products > 0) throw new BadRequestException('Cannot delete size with ' + item._count.products + ' product(s)');
    await this.prisma.size.update({ where: { id }, data: { isActive: false } });
  }
}

