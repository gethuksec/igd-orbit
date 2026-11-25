import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { SizesService } from './sizes.service';
import { MASTER_CODE_PATTERN } from '../../common/master-code.util';

/**
 * IGDERP-316 — sizes list gains totalSku/totalStock aggregates;
 * codes become flat 10-char [A-Z0-9].
 */
describe('SizesService master rework (IGDERP-316)', () => {
  let service: SizesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      size: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 's1',
            code: 'DDDDDDDDDD',
            name: 'XL',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            _count: { products: 1 },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', sizeId: 's1' }]),
      },
      productStock: {
        groupBy: jest.fn().mockResolvedValue([{ productId: 'p1', _sum: { quantityAvailable: 9 } }]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SizesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<SizesService>(SizesService);
  });

  it('returns totalSku and summed totalStock', async () => {
    const res = await service.findAll({} as any);
    expect(res.data[0]).toMatchObject({ totalSku: 1, totalStock: 9 });
  });

  it('degrades to zero stock when the aggregate query fails', async () => {
    prisma.productStock.groupBy.mockRejectedValue(new Error('no table'));
    const res = await service.findAll({} as any);
    expect(res.data[0]).toMatchObject({ totalSku: 1, totalStock: 0 });
  });

  it('generateCode returns 10-char codes', async () => {
    await expect(service.generateCode()).resolves.toMatch(MASTER_CODE_PATTERN);
  });
});
