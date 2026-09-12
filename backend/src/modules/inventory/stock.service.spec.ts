import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockService } from './stock.service';

describe('StockService — I3 list view (IGDERP-88/90/91/106)', () => {
  let service: StockService;
  let prisma: {
    productStock: { findMany: jest.Mock; count: jest.Mock };
    customerTier: { findMany: jest.Mock };
    stockMovement: { findMany: jest.Mock; count: jest.Mock; groupBy: jest.Mock };
  };

  const stockRow = (over: any = {}) => ({
    id: 'stock-1',
    productId: 'prod-1',
    branchId: 'branch-1',
    warehouseId: 'wh-1',
    quantityAvailable: 5,
    reorderPoint: 10,
    minStock: 3,
    product: { id: 'prod-1', name: 'P', sku: 'SKU', barcode: 'BC', sellingPrice: 100000, costPrice: 80000 },
    branch: { id: 'branch-1', name: 'Cabang' },
    warehouse: { id: 'wh-1', name: 'Gudang' },
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      productStock: { findMany: jest.fn(), count: jest.fn() },
      customerTier: { findMany: jest.fn() },
      stockMovement: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    };
    prisma.productStock.findMany.mockResolvedValue([stockRow()]);
    prisma.productStock.count.mockResolvedValue(1);
    prisma.customerTier.findMany.mockResolvedValue([
      { id: 't1', code: 'REGULAR', name: 'Regular', discountPercentage: 0 },
      { id: 't2', code: 'GOLD', name: 'Gold', discountPercentage: 10 },
    ]);
    prisma.stockMovement.groupBy.mockResolvedValue([]);
    prisma.stockMovement.findMany.mockResolvedValue([]);
    prisma.stockMovement.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [StockService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<StockService>(StockService);
  });

  it('hideZero filters out zero-stock rows at the query level', async () => {
    await service.getStockSummary({ hideZero: true } as any);
    expect(prisma.productStock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ quantityAvailable: { gt: 0 } }) }),
    );
    await service.getStockSummary({});
    expect(prisma.productStock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.not.objectContaining({ quantityAvailable: expect.anything() }) }),
    );
  });

  it('exposes active tiers with numeric discounts in meta (88 tier pricing)', async () => {
    const res: any = await service.getStockSummary({});
    expect(res.meta.tiers).toEqual([
      { id: 't1', code: 'REGULAR', name: 'Regular', discountPercentage: 0 },
      { id: 't2', code: 'GOLD', name: 'Gold', discountPercentage: 10 },
    ]);
  });

  it('attaches ageDays from first positive movement, null without history (91)', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    prisma.stockMovement.groupBy.mockResolvedValue([
      { productId: 'prod-1', branchId: 'branch-1', _min: { createdAt: tenDaysAgo } },
    ]);
    const res: any = await service.getStockSummary({});
    expect(res.data[0].ageDays).toBe(10);

    prisma.stockMovement.groupBy.mockResolvedValue([]);
    const res2: any = await service.getStockSummary({});
    expect(res2.data[0].ageDays).toBeNull();
  });

  it('movement search filters on product name/sku/barcode (90 detail mode)', async () => {
    await service.getStockMovementHistory({ search: 'ABC' } as any);
    expect(prisma.stockMovement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          product: {
            OR: [
              { name: { contains: 'ABC', mode: 'insensitive' } },
              { sku: { contains: 'ABC', mode: 'insensitive' } },
              { barcode: { contains: 'ABC', mode: 'insensitive' } },
            ],
          },
        }),
      }),
    );
  });

  it('export honors column subset and drops unknown keys (106)', async () => {
    const csv = await service.exportStockCsv({} as any, 'sku,available,bogus');
    const [header, body] = csv.split('\n');
    expect(header).toBe('SKU,Stok Tersedia');
    expect(body).toContain('SKU');
  });

  it('export defaults to all columns and escapes commas', async () => {
    prisma.productStock.findMany.mockResolvedValue([stockRow({ product: { name: 'A, B', sku: 'S', sellingPrice: 100, costPrice: 50 } })]);
    const csv = await service.exportStockCsv({} as any);
    expect(csv.split('\n')[0].split(',').length).toBe(Object.keys(StockService.EXPORT_COLUMNS).length);
    expect(csv).toContain('"A, B"');
  });
});
