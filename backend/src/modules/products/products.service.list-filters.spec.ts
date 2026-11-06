import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { ProductsService } from './products.service';

// List-filter coverage: classify (subCategory/color/size/unit/supplier),
// compare (price/cost), and aggregation (stock/sold/age) filters.
describe('ProductsService — list filters', () => {
  let service: ProductsService;
  let prisma: any;

  const baseProduct = (over: any = {}) => ({
    id: 'prod-1',
    barcode: '8991234567890',
    sku: 'SAM-A52',
    name: 'Samsung A52',
    description: null,
    categoryId: 'cat-1',
    category: { id: 'cat-1', code: 'CAT-HP', name: 'Handphone' },
    brandId: 'brand-1',
    brand: { id: 'brand-1', code: 'BRAND-SAMSUNG', name: 'Samsung', logoUrl: null },
    costPrice: 2800000,
    sellingPrice: 3200000,
    isService: false,
    trackSerial: false,
    trackBatch: false,
    memberPricing: null,
    images: null,
    isActive: true,
    productStocks: [],
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
    deletedAt: null,
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      product: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
      productStock: { groupBy: jest.fn() },
      salesTransactionItem: { groupBy: jest.fn() },
      stockMovement: { groupBy: jest.fn() },
      category: { findUnique: jest.fn() },
    };
    prisma.product.findMany.mockResolvedValue([baseProduct()]);
    prisma.product.count.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ProductsService>(ProductsService);
    jest.clearAllMocks();
    prisma.product.findMany.mockResolvedValue([baseProduct()]);
    prisma.product.count.mockResolvedValue(1);
    prisma.productStock.groupBy.mockResolvedValue([]);
    prisma.salesTransactionItem.groupBy.mockResolvedValue([]);
    prisma.stockMovement.groupBy.mockResolvedValue([]);
  });

  const lastFindWhere = () => {
    const calls = prisma.product.findMany.mock.calls;
    return calls[calls.length - 1][0].where;
  };

  it('applies classify filters (subCategory/color/size/unit/supplier) to where', async () => {
    await service.findAll({
      'filter[subCategory]': 'sub-1',
      'filter[color]': 'clr-1',
      'filter[size]': 'siz-1',
      'filter[unit]': 'unt-1',
      'filter[supplier]': 'sup-1',
    } as any);
    const where = lastFindWhere();
    expect(where.subCategoryId).toBe('sub-1');
    expect(where.colorId).toBe('clr-1');
    expect(where.sizeId).toBe('siz-1');
    expect(where.unitId).toBe('unt-1');
    expect(where.supplierId).toBe('sup-1');
  });

  it('applies price/cost compare operators', async () => {
    await service.findAll({ 'filter[priceOp]': 'lt', 'filter[priceValue]': 500000 } as any);
    expect(lastFindWhere().sellingPrice).toEqual({ lt: 500000 });

    await service.findAll({ 'filter[costOp]': 'gt', 'filter[costValue]': 100000 } as any);
    expect(lastFindWhere().costPrice).toEqual({ gt: 100000 });
  });

  it('stock filter matches ids by total available and annotates rows', async () => {
    prisma.productStock.groupBy.mockResolvedValue([
      { productId: 'prod-1', _sum: { quantityAvailable: 4 } },
    ]);
    // candidate pass for the aggregation scope
    prisma.product.findMany
      .mockResolvedValueOnce([{ id: 'prod-1' }])
      .mockResolvedValueOnce([baseProduct()]);
    prisma.salesTransactionItem.groupBy.mockResolvedValue([]);
    prisma.stockMovement.groupBy.mockResolvedValue([]);

    const out = await service.findAll({ 'filter[stockOp]': 'lt', 'filter[stockValue]': 10 } as any);
    const where = prisma.product.findMany.mock.calls[1][0].where;
    expect(where.id).toEqual({ in: ['prod-1'] });
    expect(out.data).toHaveLength(1);
  });

  it('stock filter with no match returns empty page without querying rows', async () => {
    prisma.productStock.groupBy.mockResolvedValue([]);
    prisma.product.findMany.mockResolvedValueOnce([]);

    const out = await service.findAll({ 'filter[stockOp]': 'gt', 'filter[stockValue]': 100 } as any);
    expect(out.data).toEqual([]);
    expect(out.meta.total).toBe(0);
    expect(prisma.product.count).not.toHaveBeenCalled();
  });

  it('sold filter counts never-sold products as 0', async () => {
    prisma.salesTransactionItem.groupBy.mockResolvedValue([]);
    prisma.product.findMany
      .mockResolvedValueOnce([{ id: 'prod-1' }, { id: 'prod-2' }])
      .mockResolvedValueOnce([baseProduct()]);
    prisma.stockMovement.groupBy.mockResolvedValue([]);

    await service.findAll({ 'filter[soldOp]': 'lt', 'filter[soldValue]': 5 } as any);
    const where = prisma.product.findMany.mock.calls[1][0].where;
    expect(where.id).toEqual({ in: ['prod-1', 'prod-2'] });
  });

  it('sold filter excludes never-sold products on gt', async () => {
    prisma.salesTransactionItem.groupBy.mockResolvedValue([
      { productId: 'prod-1', _sum: { quantity: 132 } },
    ]);
    prisma.product.findMany
      .mockResolvedValueOnce([{ id: 'prod-1' }, { id: 'prod-2' }])
      .mockResolvedValueOnce([baseProduct()]);
    prisma.stockMovement.groupBy.mockResolvedValue([]);

    await service.findAll({ 'filter[soldOp]': 'gt', 'filter[soldValue]': 50 } as any);
    const where = prisma.product.findMany.mock.calls[1][0].where;
    expect(where.id).toEqual({ in: ['prod-1'] });
  });

  it('age filter uses last IN movement, falls back to createdAt', async () => {
    const oldRestock = new Date(Date.now() - 120 * 86400000); // 120 days ago
    const recentCreate = new Date(Date.now() - 10 * 86400000); // 10 days ago
    prisma.stockMovement.groupBy.mockResolvedValue([{ productId: 'prod-1', _max: { createdAt: oldRestock } }]);
    prisma.product.findMany
      .mockResolvedValueOnce([
        { id: 'prod-1', createdAt: new Date('2025-01-01T00:00:00Z') },
        { id: 'prod-2', createdAt: recentCreate },
      ])
      .mockResolvedValueOnce([baseProduct()]);

    await service.findAll({ 'filter[ageOp]': 'gt', 'filter[ageValue]': 3, 'filter[ageUnit]': 'months' } as any);
    const where = prisma.product.findMany.mock.calls[1][0].where;
    // 90-day cutoff: prod-1 (120d since restock) matches, prod-2 (10d) does not
    expect(where.id).toEqual({ in: ['prod-1'] });
  });

  it('attaches totalSold + lastRestockAt annotations to rows', async () => {
    const restock = new Date('2026-10-01T00:00:00Z');
    prisma.salesTransactionItem.groupBy.mockResolvedValue([
      { productId: 'prod-1', _sum: { quantity: 132 } },
    ]);
    prisma.stockMovement.groupBy.mockResolvedValue([
      { productId: 'prod-1', _max: { createdAt: restock } },
    ]);

    const out = await service.findAll({} as any);
    expect(out.data[0].totalSold).toBe(132);
    expect(out.data[0].lastRestockAt).toEqual(restock);
  });
});
