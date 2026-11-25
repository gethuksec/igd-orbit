import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { UnitsService } from './units.service';
import { MASTER_CODE_PATTERN } from '../../common/master-code.util';

/**
 * IGDERP-316 — units list gains totalSku/totalStock aggregates;
 * codes become flat 10-char [A-Z0-9].
 */
describe('UnitsService master rework (IGDERP-316)', () => {
  let service: UnitsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      unit: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'u1',
            code: 'CCCCCCCCCC',
            name: 'pcs',
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
        findMany: jest.fn().mockResolvedValue([{ id: 'p1', unitId: 'u1' }]),
      },
      productStock: {
        groupBy: jest.fn().mockResolvedValue([{ productId: 'p1', _sum: { quantityAvailable: 3 } }]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UnitsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UnitsService>(UnitsService);
  });

  it('returns totalSku and summed totalStock', async () => {
    const res = await service.findAll({} as any);
    expect(res.data[0]).toMatchObject({ totalSku: 1, totalStock: 3 });
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
