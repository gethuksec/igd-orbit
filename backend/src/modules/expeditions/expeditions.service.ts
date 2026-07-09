import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateExpeditionDto, UpdateExpeditionDto, ListExpeditionsDto } from './dto';
import { randomBytes } from 'crypto';
@Injectable()
export class ExpeditionsService {
  constructor(private prisma: PrismaService) {}
  async generateCode(): Promise<string> {
    let code: string; let isUnique = false; let attempts = 0;
    while (!isUnique && attempts < 10) {
      code = 'EXP-' + randomBytes(4).toString('hex').toUpperCase();
      if (!(await this.prisma.expedition.findUnique({ where: { code } }))) isUnique = true; attempts++;
    }
    if (!isUnique) throw new BadRequestException('Failed to generate unique code');
    return code!;
  }
  async findAll(query: ListExpeditionsDto) {
    const pageNum = +(query.page || 1), limitNum = +(query.limit || 20);
    const where: any = { isActive: true };
    if (query.search) where.OR = [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }];
    const [items, total] = await Promise.all([this.prisma.expedition.findMany({ where, skip: (pageNum - 1) * limitNum, take: limitNum, orderBy: { name: 'asc' } }), this.prisma.expedition.count({ where })]);
    return { data: items.map((item: any) => ({ id: item.id, code: item.code, name: item.name, isActive: item.isActive, createdAt: item.createdAt, updatedAt: item.updatedAt })), meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } };
  }
  async findById(id: string) {
    const item = await this.prisma.expedition.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Expedition not found');
    return { id: item.id, code: item.code, name: item.name, isActive: item.isActive, createdAt: item.createdAt, updatedAt: item.updatedAt };
  }
  async create(dto: CreateExpeditionDto) {
    let code = dto.code || await this.generateCode();
    if (dto.code) { const e = await this.prisma.expedition.findUnique({ where: { code } }); if (e) throw new ConflictException('Code already exists'); }
    const e = await this.prisma.expedition.findFirst({ where: { name: dto.name, isActive: true } }); if (e) throw new ConflictException('Name must be unique');
    const item = await this.prisma.expedition.create({ data: { code, name: dto.name, isActive: true } });
    return { id: item.id, code: item.code, name: item.name, isActive: item.isActive, createdAt: item.createdAt, updatedAt: item.updatedAt };
  }
  async update(id: string, dto: UpdateExpeditionDto) {
    const item = await this.prisma.expedition.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Expedition not found');
    if (dto.name && dto.name !== item.name) { const e = await this.prisma.expedition.findFirst({ where: { name: dto.name, isActive: true, id: { not: id } } }); if (e) throw new ConflictException('Name must be unique'); }
    if (dto.code && dto.code !== item.code) { const e = await this.prisma.expedition.findUnique({ where: { code: dto.code } }); if (e) throw new ConflictException('Code already exists'); }
    const ud: any = {};
    if (dto.name !== undefined) ud.name = dto.name;
    if (dto.code !== undefined) ud.code = dto.code;
    const updated = await this.prisma.expedition.update({ where: { id }, data: ud });
    return { id: updated.id, code: updated.code, name: updated.name, isActive: updated.isActive, createdAt: updated.createdAt, updatedAt: updated.updatedAt };
  }
  async delete(id: string): Promise<void> {
    const item = await this.prisma.expedition.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Expedition not found');
    await this.prisma.expedition.update({ where: { id }, data: { isActive: false } });
  }
}
