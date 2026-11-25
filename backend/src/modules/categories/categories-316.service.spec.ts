import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { CategoriesService } from './categories.service';
import { MASTER_CODE_PATTERN } from '../../common/master-code.util';

/**
 * IGDERP-316 — paginated categories gain totalSku/totalStock/grades
 * aggregates + filter-scoped totalGrades; codes become 10-char [A-Z0-9].
 */
describe('CategoriesService master rework (IGDERP-316)', () => {
  let service: CategoriesService;
  let prisma: any;

  const pageRows = [
    {
      id: 'cat1',
      code: 'EEEEEEEEEE',
      name: 'Battery',
      description: null,
      parentCategoryId: null,
      parentCategory: null,
      isActive: true,
      tierMargins: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { products: 2 },
    },
  ];

  beforeEach(async () => {
    prisma = {
      category: {
        findMany: jest.fn().mockImplementation(async (args: any) => {
          // Filter-scoped id list for the totalGrades query
          if (args?.select?.id) return [{ id: 'cat1' }];
          return pageRows;
        }),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      product: {
        findMany: jest.fn().mockImplementation(async (args: any) => {
          if (args?.distinct) return [{ grade: 'A' }, { grade: 'ORI' }];
          return [
            { id: 'p1', categoryId: 'cat1', grade: 'A' },
            { id: 'p2', categoryId: 'cat1', grade: 'ORI' },
          ];
        }),
        count: jest.fn().mockResolvedValue(0),
      },
      productStock: {
        groupBy: jest.fn().mockResolvedValue([
          { productId: 'p1', _sum: { quantityAvailable: 10 } },
          { productId: 'p2', _sum: { quantityAvailable: 20 } },
        ]),
      },
      categoryGrade: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'g1', code: 'GGGGGGGGGG', name: 'A', categoryId: 'cat1' },
          { id: 'g2', code: 'HHHHHHHHHH', name: 'ORI', categoryId: 'cat1' },
        ]),
        count: jest.fn().mockResolvedValue(2),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('returns totalSku/totalStock/grades per row and filter-scoped totalGrades', async () => {
    const res = await service.findAllPaginated(1, 20);
    expect(res.data[0]).toMatchObject({ totalSku: 2, totalStock: 30 });
    expect(res.data[0].grades).toEqual([
      { id: 'g1', code: 'GGGGGGGGGG', name: 'A' },
      { id: 'g2', code: 'HHHHHHHHHH', name: 'ORI' },
    ]);
    expect(res.meta).toMatchObject({ totalGrades: 2 });
  });

  it('degrades aggregates when stock tables are missing', async () => {
    prisma.productStock.groupBy.mockRejectedValue(new Error('no table'));
    prisma.categoryGrade.findMany.mockRejectedValue(new Error('no table'));
    const res = await service.findAllPaginated(1, 20);
    expect(res.data[0]).toMatchObject({ totalSku: 2, totalStock: 0, grades: [] });
    expect(res.meta).toMatchObject({ totalGrades: 0 });
  });

  it('generateCode returns 10-char codes', async () => {
    await expect(service.generateCode()).resolves.toMatch(MASTER_CODE_PATTERN);
  });
});
