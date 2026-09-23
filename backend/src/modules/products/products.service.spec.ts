import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { ProductsService } from './products.service';

// NOTE: repo has no package-lock; fresh installs resolve @prisma/client 5.22
// where the `Prisma.Decimal` re-export is gone (pre-existing landmine across
// all services using `new Prisma.Decimal` — flagged separately). Stub it so
// these guard specs run independent of the resolved client version.
jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  class DecimalStub {
    private v: string;
    constructor(v: any) {
      this.v = String(v);
    }
    toString() {
      return this.v;
    }
    valueOf() {
      return Number(this.v);
    }
    toNumber() {
      return Number(this.v);
    }
  }
  return { ...actual, Prisma: { Decimal: DecimalStub } };
});

// IGDERP-195 (PROD-003 data check): minSellingPrice above sellingPrice is
// invalid data (live PROD-003 had min 149.999.000 vs selling 18.000.000).
describe('ProductsService — min<=selling guard (IGDERP-195)', () => {
  let service: ProductsService;
  let prisma: {
    product: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    category: { findUnique: jest.Mock };
  };

  const baseDto = (over: any = {}) => ({
    sku: 'PROD-TEST',
    name: 'Test Product',
    categoryId: 'cat-1',
    costPrice: 10000000,
    sellingPrice: 18000000,
    unitId: 'unit-1',
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      category: { findUnique: jest.fn() },
    };
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    prisma.product.create.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));
    prisma.product.update.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ProductsService>(ProductsService);
  });

  it('create rejects minSellingPrice above sellingPrice (PROD-003 shape)', async () => {
    await expect(
      service.create(baseDto({ minSellingPrice: 149999000 }) as any, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('create accepts a valid minimum', async () => {
    const p = await service.create(baseDto({ minSellingPrice: 15000000 }) as any, 'user-1');
    expect(prisma.product.create).toHaveBeenCalled();
    expect(p).toBeDefined();
  });

  it('update rejects a merged minimum above (existing or new) selling price', async () => {
    prisma.product.findUnique.mockResolvedValueOnce({
      id: 'p1',
      sku: 'PROD-003',
      sellingPrice: 18000000,
      minSellingPrice: null,
    });
    await expect(
      service.update('p1', { minSellingPrice: 149999000 } as any, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('update rejects lowering the selling price below the stored minimum', async () => {
    prisma.product.findUnique.mockResolvedValueOnce({
      id: 'p1',
      sku: 'PROD-003',
      sellingPrice: 18000000,
      minSellingPrice: 15000000,
    });
    await expect(
      service.update('p1', { sellingPrice: 14000000 } as any, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
