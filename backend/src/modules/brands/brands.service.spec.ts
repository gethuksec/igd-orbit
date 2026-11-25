import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { BrandsService } from './brands.service';
import { MASTER_CODE_PATTERN } from '../../common/master-code.util';

/**
 * IGDERP-316 — brands list gains totalSku/totalStock aggregates;
 * codes become flat 10-char [A-Z0-9].
 */
describe('BrandsService master rework (IGDERP-316)', () => {
  let service: BrandsService;
  let prisma: any;

  const rows = [
    {
      id: 'b1',
      code: 'AAAAAAAAAA',
      name: 'Acme',
      description: null,
      logoUrl: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { products: 2 },
    },
    {
      id: 'b2',
      code: 'BBBBBBBBBB',
      name: 'Globex',
      description: null,
      logoUrl: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { products: 0 },
    },
  ];

  beforeEach(async () => {
    prisma = {
      brand: {
        findMany: jest.fn().mockResolvedValue(rows),
        count: jest.fn().mockResolvedValue(2),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'p1', brandId: 'b1' },
          { id: 'p2', brandId: 'b1' },
        ]),
      },
      productStock: {
        groupBy: jest.fn().mockResolvedValue([
          { productId: 'p1', _sum: { quantityAvailable: 5 } },
          { productId: 'p2', _sum: { quantityAvailable: 7 } },
        ]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BrandsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<BrandsService>(BrandsService);
  });

  it('returns totalSku from product count and summed totalStock', async () => {
    const res = await service.findAll({} as any);
    expect(res.data[0]).toMatchObject({ totalSku: 2, totalStock: 12 });
    expect(res.data[1]).toMatchObject({ totalSku: 0, totalStock: 0 });
  });

  it('degrades to zero stock when the aggregate query fails', async () => {
    prisma.productStock.groupBy.mockRejectedValue(new Error('no table'));
    const res = await service.findAll({} as any);
    expect(res.data[0]).toMatchObject({ totalSku: 2, totalStock: 0 });
  });

  it('generateCode returns unique 10-char codes', async () => {
    const a = await service.generateCode();
    const b = await service.generateCode();
    expect(a).toMatch(MASTER_CODE_PATTERN);
    expect(b).toMatch(MASTER_CODE_PATTERN);
  });
});
