import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { PositionsService } from './positions.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

function mockDelegate() {
  return {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
}

async function boot() {
  const delegates = {
    position: mockDelegate(),
    division: mockDelegate(),
    department: mockDelegate(),
    grade: mockDelegate(),
    role: mockDelegate(),
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [PositionsService, { provide: PrismaService, useValue: delegates }],
  }).compile();
  return { service: module.get(PositionsService), prisma: delegates };
}

const ACTIVE = { id: 'x', isActive: true };

describe('PositionsService (IGDERP-277)', () => {
  it('creates staff position with grade', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue(null);
    prisma.grade.findUnique.mockResolvedValue(ACTIVE);
    prisma.position.create.mockImplementation(async ({ data }: any) => ({ id: 'p-1', ...data }));
    const res: any = await service.create({
      code: 'CS-3',
      name: 'STAFF CASHIER 3',
      rank: 6,
      gradeId: 'g3',
      minSalary: 3000000,
    });
    expect(res.code).toBe('CS-3');
    expect(res.gradeId).toBe('g3');
  });

  it('rejects staff position without grade', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ code: 'CS-X', name: 'X', rank: 6 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects grade on non-staff position', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ code: 'MU', name: 'Manager Unit', rank: 2, gradeId: 'g1' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates non-staff title without grade', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue(ACTIVE);
    prisma.position.create.mockImplementation(async ({ data }: any) => ({ id: 'p-2', ...data }));
    const res: any = await service.create({
      code: 'MU',
      name: 'MANAGER UNIT',
      rank: 2,
      minSalary: 8000000,
      defaultRoleId: 'r-mu',
    });
    expect(res.rank).toBe(2);
    expect(res.gradeId).toBeUndefined();
  });

  it('rejects duplicate code', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue({ id: 'dup' });
    await expect(service.create({ code: 'CS-1', name: 'X', rank: 6, gradeId: 'g' } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects unknown division reference', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue(null);
    prisma.division.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ code: 'SE-1', name: 'X', rank: 6, gradeId: 'g1', divisionId: 'nope' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks deactivation while employees attached', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue({ id: 'p-1', _count: { employees: 2 } });
    await expect(service.remove('p-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 404 for unknown position', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue(null);
    await expect(service.findById('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
