import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { SizesService } from './sizes.service';

/**
 * IGDERP-158 — GET /api/v1/sizes?status=inactive always returned empty.
 * Root cause: findAll() hardcoded `deletedAt: null`, but delete()
 * soft-deletes by setting BOTH isActive=false AND deletedAt=now — so
 * trashed rows were excluded before the isActive filter could match.
 * Fix mirrors products.service.ts: deletedAt follows the status filter.
 */
describe('SizesService findAll status filter (IGDERP-158)', () => {
  let service: SizesService;
  let prisma: {
    size: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      size: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SizesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SizesService>(SizesService);
  });

  function lastWhere() {
    expect(prisma.size.findMany).toHaveBeenCalled();
    return prisma.size.findMany.mock.calls[0][0].where;
  }

  it('status=inactive queries soft-deleted rows (deletedAt not-null + isActive false)', async () => {
    await service.findAll({ status: 'inactive' } as any);

    expect(lastWhere()).toEqual(
      expect.objectContaining({
        deletedAt: { not: null },
        isActive: false,
      }),
    );
    expect(prisma.size.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        deletedAt: { not: null },
        isActive: false,
      }),
    });
  });

  it('default query returns active-only (deletedAt null + isActive true)', async () => {
    await service.findAll({} as any);

    expect(lastWhere()).toEqual(
      expect.objectContaining({ deletedAt: null, isActive: true }),
    );
  });

  it('status=active queries non-deleted active rows', async () => {
    await service.findAll({ status: 'active' } as any);

    expect(lastWhere()).toEqual(
      expect.objectContaining({ deletedAt: null, isActive: true }),
    );
  });

  it('status=all lifts both filters (deletedAt undefined, no isActive)', async () => {
    await service.findAll({ status: 'all' } as any);

    const where = lastWhere();
    expect(where.deletedAt).toBeUndefined();
    expect(where).not.toHaveProperty('isActive');
  });

  it('includeInactive without status lifts both filters (backward compat)', async () => {
    await service.findAll({ includeInactive: true } as any);

    const where = lastWhere();
    expect(where.deletedAt).toBeUndefined();
    expect(where).not.toHaveProperty('isActive');
  });
});
