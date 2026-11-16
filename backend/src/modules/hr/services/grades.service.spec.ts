import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { GradesService } from './grades.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

function mockDelegate() {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
}

async function boot() {
  const delegates = { grade: mockDelegate() };
  const module: TestingModule = await Test.createTestingModule({
    providers: [GradesService, { provide: PrismaService, useValue: delegates }],
  }).compile();
  return { service: module.get(GradesService), prisma: delegates };
}

describe('GradesService (IGDERP-277)', () => {
  it('creates G1-G6 rows with unique rank', async () => {
    const { service, prisma }: any = await boot();
    prisma.grade.findUnique.mockResolvedValue(null);
    prisma.grade.findFirst.mockResolvedValue(null);
    prisma.grade.create.mockImplementation(async ({ data }: any) => ({ id: 'g-1', ...data }));
    const res: any = await service.create({ code: 'G1', name: 'Grade 1', rank: 1 });
    expect(res.code).toBe('G1');
    expect(res.rank).toBe(1);
  });

  it('rejects duplicate rank', async () => {
    const { service, prisma }: any = await boot();
    prisma.grade.findUnique.mockResolvedValue(null);
    prisma.grade.findFirst.mockResolvedValue({ id: 'g-1', code: 'G1' });
    await expect(service.create({ code: 'GX', name: 'X', rank: 1 } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects duplicate code', async () => {
    const { service, prisma }: any = await boot();
    prisma.grade.findUnique.mockResolvedValue({ id: 'dup' });
    await expect(service.create({ code: 'G1', name: 'X', rank: 9 } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('blocks deactivation while positions attached', async () => {
    const { service, prisma }: any = await boot();
    prisma.grade.findUnique.mockResolvedValue({ id: 'g-1', _count: { positions: 3 } });
    await expect(service.remove('g-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 404 for unknown grade', async () => {
    const { service, prisma }: any = await boot();
    prisma.grade.findUnique.mockResolvedValue(null);
    await expect(service.findById('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
