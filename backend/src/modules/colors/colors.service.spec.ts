import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { ColorsService } from './colors.service';

/**
 * IGDERP-316 — colors list gains totalSku/totalStock aggregates.
 * (Color keeps its legacy code generator — no code anywhere in UI.)
 */
describe('ColorsService master rework (IGDERP-316)', () => {
  let service: ColorsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      color: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'c1',
            code: 'CLR-LEGACY',
            name: 'Red',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            _count: { products: 2 },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p1', colorId: 'c1' },
          { id: 'p2', colorId: 'c1' },
        ]),
      },
      productStock: {
        groupBy: jest.fn().mockResolvedValue([
          { productId: 'p1', _sum: { quantityAvailable: 4 } },
          { productId: 'p2', _sum: { quantityAvailable: null } },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ColorsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ColorsService>(ColorsService);
  });

  it('returns totalSku and summed totalStock (null sums count as 0)', async () => {
    const res = await service.findAll({} as any);
    expect(res.data[0]).toMatchObject({ totalSku: 2, totalStock: 4 });
  });

  it('degrades to zero stock when the aggregate query fails', async () => {
    prisma.product.findMany.mockRejectedValue(new Error('no table'));
    const res = await service.findAll({} as any);
    expect(res.data[0]).toMatchObject({ totalSku: 2, totalStock: 0 });
  });
});
