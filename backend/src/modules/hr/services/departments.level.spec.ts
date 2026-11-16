import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { DepartmentsService } from './departments.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

async function boot(deptRow: any) {
  const delegates = {
    department: {
      findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
        where.id === 'parent-1' ? deptRow : null,
      ),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'd-new', ...data })),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'd-1', ...data })),
    },
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [DepartmentsService, { provide: PrismaService, useValue: delegates }],
  }).compile();
  return { service: module.get(DepartmentsService) };
}

describe('DepartmentsService levels (IGDERP-277)', () => {
  it('defaults roots to level 1', async () => {
    const { service }: any = await boot({ id: 'parent-1', level: 1 });
    const res: any = await service.create({ code: 'DEPT-X', name: 'X' });
    expect(res.level).toBe(1);
  });

  it('forces child to parent + 1', async () => {
    const { service }: any = await boot({ id: 'parent-1', level: 1 });
    const res: any = await service.create({ code: 'DEPT-Y', name: 'Y', parentDepartmentId: 'parent-1' });
    expect(res.level).toBe(2);
  });

  it('rejects wrong child level', async () => {
    const { service }: any = await boot({ id: 'parent-1', level: 1 });
    await expect(
      service.create({ code: 'DEPT-Z', name: 'Z', parentDepartmentId: 'parent-1', level: 5 } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown parent', async () => {
    const { service }: any = await boot({ id: 'parent-1', level: 1 });
    await expect(
      service.create({ code: 'DEPT-W', name: 'W', parentDepartmentId: 'missing' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('still throws 404 for unknown department on update', async () => {
    const { service }: any = await boot({ id: 'parent-1', level: 1 });
    // findUnique returns null for any id except parent-1; use unknown id
    await expect(service.findById('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
