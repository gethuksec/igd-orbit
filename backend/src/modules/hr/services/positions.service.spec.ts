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

  it('allows explicit grade on non-staff position', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue(null);
    prisma.grade.findUnique.mockResolvedValue(ACTIVE);
    prisma.position.create.mockImplementation(async ({ data }: any) => ({ id: 'p-3', ...data }));
    const res: any = await service.create({
      code: 'MU',
      name: 'Manager Unit',
      rank: 2,
      gradeId: 'g1',
    } as any);
    expect(res.gradeId).toBe('g1');
  });

  it('creates non-staff title defaulting to G1', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue(ACTIVE);
    prisma.grade.findUnique.mockResolvedValue({ id: 'g-g1', code: 'G1', isActive: true });
    prisma.position.create.mockImplementation(async ({ data }: any) => ({ id: 'p-2', ...data }));
    const res: any = await service.create({
      code: 'MU',
      name: 'MANAGER UNIT',
      rank: 2,
      minSalary: 8000000,
      defaultRoleId: 'r-mu',
    });
    expect(res.rank).toBe(2);
    expect(res.gradeId).toBe('g-g1');
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

describe('PositionsService.getGradesByPosition (IGDERP-301 D4)', () => {
  it('returns the grade matrix for staff titles', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue({ id: 'p-tc2', code: 'TC-2', rank: 6, gradeId: 'g2' });
    prisma.position.findMany.mockResolvedValue([
      { id: 'p-tc1', code: 'TC-1', gradeId: 'g1' },
      { id: 'p-tc2', code: 'TC-2', gradeId: 'g2' },
    ]);
    prisma.grade.findMany.mockResolvedValue([
      { id: 'g1', code: 'G1', rank: 1 },
      { id: 'g2', code: 'G2', rank: 2 },
    ]);
    const res: any = await service.getGradesByPosition('p-tc2');
    expect(res.titleCode).toBe('TC');
    expect(res.grades).toHaveLength(2);
    expect(res.positions).toHaveLength(2);
    expect(res.gradeId).toBe('g2');
  });

  it('returns grade options for non-staff titles (no remap)', async () => {
    const { service: svc2, prisma: prisma2 }: any = await boot();
    prisma2.position.findUnique.mockResolvedValue({ id: 'p-mu', code: 'MU', rank: 2, gradeId: 'g1' });
    prisma2.grade.findMany.mockResolvedValue([
      { id: 'g1', code: 'G1', rank: 1 },
      { id: 'g2', code: 'G2', rank: 2 },
    ]);
    const res: any = await svc2.getGradesByPosition('p-mu');
    expect(res.grades).toHaveLength(2);
    expect(res.positions).toEqual([]);
    expect(res.titleCode).toBe('MU');
    expect(res.gradeId).toBe('g1');
  });

  it('404s unknown position ids', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue(null);
    await expect(service.getGradesByPosition('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PositionsService N+1 (vertical atasan edge)', () => {
  const PARENT = { id: 'p-as', code: 'AS-SE', rank: 5, isActive: true, parentPositionId: 'p-hs' };
  const GRANDPARENT = { id: 'p-hs', code: 'HS', rank: 4, isActive: true, parentPositionId: null };

  function parentChain(prisma: any) {
    prisma.position.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === 'p-as') return PARENT;
      if (where.id === 'p-hs') return GRANDPARENT;
      if (where.id === 'p-mu-top') return { id: 'p-mu-top', rank: 2, isActive: true, parentPositionId: null };
      return null;
    });
  }

  it('accepts a higher-rank active parent on create', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValueOnce(null); // code free
    parentChain(prisma);
    prisma.grade.findUnique.mockResolvedValue({ id: 'g2', isActive: true });
    prisma.position.create.mockImplementation(async ({ data }: any) => ({ id: 'p-se', ...data }));
    const res: any = await service.create({
      code: 'SE-1',
      name: 'STAFF SE 1',
      rank: 6,
      gradeId: 'g2',
      parentPositionId: 'p-as',
    } as any);
    expect(res.parentPositionId).toBe('p-as');
  });

  it('rejects self as parent on update', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue({ id: 'p-as', rank: 5, gradeId: 'g1' });
    await expect(
      service.update('p-as', { parentPositionId: 'p-as' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a same-or-lower-rank parent', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValueOnce(null); // code free
    prisma.position.findUnique.mockResolvedValue({ id: 'p-peer', rank: 6, isActive: true, parentPositionId: null });
    await expect(
      service.create({ code: 'SE-9', name: 'X', rank: 6, gradeId: 'g2', parentPositionId: 'p-peer' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive parent', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValueOnce(null); // code free
    prisma.position.findUnique.mockResolvedValue({ id: 'p-old', rank: 4, isActive: false, parentPositionId: null });
    await expect(
      service.create({ code: 'SE-9', name: 'X', rank: 6, gradeId: 'g2', parentPositionId: 'p-old' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a reporting cycle', async () => {
    const { service, prisma }: any = await boot();
    // p-mid (rank 5) tries to take p-a (rank 4) whose own chain loops back to p-mid.
    prisma.position.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.code) return null;
      if (where.id === 'p-mid') return { id: 'p-mid', rank: 5, gradeId: 'g1' };
      if (where.id === 'p-a') return { id: 'p-a', rank: 4, isActive: true, parentPositionId: 'p-mid' };
      return null;
    });
    await expect(
      service.update('p-mid', { parentPositionId: 'p-a' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks deactivation while titles point at it as N+1', async () => {
    const { service, prisma }: any = await boot();
    prisma.position.findUnique.mockResolvedValue({ id: 'p-as', _count: { employees: 0 } });
    prisma.position.count.mockResolvedValue(2);
    await expect(service.remove('p-as')).rejects.toBeInstanceOf(BadRequestException);
  });
});
