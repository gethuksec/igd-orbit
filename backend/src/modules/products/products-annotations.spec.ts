import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { ProductsService } from './products.service';
import { ProductTransformer, emptyAnnotations } from './transformers/product.transformer';

// IGDERP-310 — list annotations: class/modal/umur/usia/nilai.
describe('ProductsService — list annotations (IGDERP-310)', () => {
  let service: ProductsService;
  let prisma: any;

  const DAY = 86400000;
  const ago = (days: number) => new Date(Date.now() - days * DAY);

  const baseProduct = (over: any = {}) => ({
    id: 'prod-1',
    barcode: '310720160001',
    sku: 'SAM-A52',
    name: 'Samsung A52',
    description: null,
    categoryId: 'cat-1',
    category: { id: 'cat-1', code: 'CAT-HP', name: 'Handphone' },
    brandId: 'brand-1',
    brand: { id: 'brand-1', code: 'BRAND-SAMSUNG', name: 'Samsung', logoUrl: null },
    costPrice: 10000,
    sellingPrice: 15000,
    minSellingPrice: 12000,
    grade: 'Original',
    isService: false,
    trackSerial: false,
    trackBatch: false,
    memberPricing: null,
    images: null,
    isActive: true,
    productStocks: [{ quantityAvailable: 10, quantityReserved: 2, quantityDamaged: 0 }],
    createdAt: ago(200),
    updatedAt: ago(200),
    deletedAt: null,
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      product: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
      productStock: { groupBy: jest.fn().mockResolvedValue([]) },
      salesTransactionItem: { groupBy: jest.fn().mockResolvedValue([]) },
      stockMovement: { groupBy: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    prisma.product.findMany.mockResolvedValue([baseProduct()]);
    prisma.product.count.mockResolvedValue(1);
    prisma.product.aggregate.mockResolvedValue({
      _sum: { sellingPrice: 15000, minSellingPrice: 12000 },
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ProductsService>(ProductsService);
  });

  describe('classifySales', () => {
    const c = ProductTransformer.classifySales;
    it('fast at >= 30 units in 30d (~1/day)', () => {
      expect(c(30, 0, 30, 200)).toBe('fast');
      expect(c(120, 30, 200, 400)).toBe('fast');
    });
    it('medium at >= 12 in 30d or >= 3 in 7d (~3/week)', () => {
      expect(c(12, 0, 12, 200)).toBe('medium');
      expect(c(5, 3, 5, 200)).toBe('medium');
      expect(c(29, 1, 40, 200)).toBe('medium');
    });
    it('slow on any sale in 90d below medium, or young with no history', () => {
      expect(c(2, 0, 2, 200)).toBe('slow');
      expect(c(0, 0, 0, 10)).toBe('slow');
      expect(c(0, 0, 0, null)).toBe('slow');
    });
    it('dead on no sale in 90d with warehouse age above 90d', () => {
      expect(c(0, 0, 0, 91)).toBe('dead');
      expect(c(0, 0, 0, 400)).toBe('dead');
    });
  });

  describe('transform derivation', () => {
    it('computes modal/nilai/umur/usia/kelas from annotations', () => {
      const ann = new Map([
        [
          'prod-1',
          {
            ...emptyAnnotations(),
            totalSold: 100,
            lastRestockAt: ago(40),
            firstStockAt: ago(200),
            lastPurchaseAt: ago(30),
            lastPurchasePrice: 9500,
            avgPurchasePrice: 9000,
            sold90d: 40,
            sold30d: 35,
            sold7d: 2,
            lastSaleAt: ago(1),
          },
        ],
      ]);
      const out: any = ProductTransformer.transform(baseProduct() as any, false, ann);
      expect(out.modalTerakhir).toBe(9500);
      expect(out.modalPurata).toBe(9000);
      expect(out.nilaiStok).toBe(9000 * 8); // net stock 10 - 2
      expect(out.umurHari).toBe(30);
      expect(out.usiaHari).toBe(200);
      expect(out.kelas).toBe('fast');
      expect(out.totalSold).toBe(100);
      expect(out.grade).toBe('Original');
    });

    it('falls back to costPrice and nulls without purchase history', () => {
      const ann = new Map([['prod-1', emptyAnnotations()]]);
      const out: any = ProductTransformer.transform(baseProduct() as any, false, ann);
      expect(out.modalTerakhir).toBeNull();
      expect(out.modalPurata).toBeNull();
      expect(out.nilaiStok).toBe(10000 * 8);
      expect(out.usiaHari).toBe(200);
      expect(out.umurHari).toBe(200); // no purchase/IN → createdAt base
    });

    it('marks never-sold old products dead', () => {
      const ann = new Map([['prod-1', emptyAnnotations()]]);
      const out: any = ProductTransformer.transform(baseProduct() as any, false, ann);
      expect(out.kelas).toBe('dead');
    });
  });

  describe('findAll wiring', () => {
    it('attaches purchase + velocity annotations to rows', async () => {
      prisma.salesTransactionItem.groupBy
        .mockResolvedValueOnce([{ productId: 'prod-1', _sum: { quantity: 100 } }])
        .mockResolvedValueOnce([{ productId: 'prod-1', _sum: { quantity: 40 } }])
        .mockResolvedValueOnce([{ productId: 'prod-1', _sum: { quantity: 35 } }])
        .mockResolvedValueOnce([{ productId: 'prod-1', _sum: { quantity: 2 } }])
        .mockResolvedValueOnce([{ productId: 'prod-1', _max: { createdAt: ago(1) } }]);
      prisma.stockMovement.groupBy.mockResolvedValue([
        { productId: 'prod-1', _max: { createdAt: ago(40) }, _min: { createdAt: ago(200) } },
      ]);
      prisma.$queryRaw.mockResolvedValue([
        { product_id: 'prod-1', avg_price: 9000, last_price: 9500, last_date: ago(30) },
      ]);

      const out = await service.findAll({} as any);
      const row: any = out.data[0];
      expect(row.modalTerakhir).toBe(9500);
      expect(row.modalPurata).toBe(9000);
      expect(row.nilaiStok).toBe(72000);
      expect(row.umurHari).toBe(30);
      expect(row.usiaHari).toBe(200);
      expect(row.kelas).toBe('fast');
    });
  });

  describe('getStatistics', () => {
    it('values stock at purchase-based modal and sums regular/silver', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          costPrice: { toNumber: () => 1000 },
          isActive: true,
          productStocks: [
            { quantityAvailable: { toNumber: () => 5 }, quantityReserved: { toNumber: () => 0 }, minStock: null },
          ],
        },
      ]);
      prisma.$queryRaw.mockResolvedValue([{ product_id: 'prod-1', avg_price: 800 }]);

      const stats = await service.getStatistics();
      expect(stats.totalStockValue).toBe(4000); // 5 * avg 800, not cost 1000
      expect(stats.sumRegular).toBe(15000);
      expect(stats.sumSilver).toBe(12000);
      expect(stats.activeCount).toBe(1);
    });

    it('falls back to costPrice when purchase stats are unavailable', async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          id: 'prod-1',
          costPrice: { toNumber: () => 1000 },
          isActive: true,
          productStocks: [
            { quantityAvailable: { toNumber: () => 5 }, quantityReserved: { toNumber: () => 0 }, minStock: null },
          ],
        },
      ]);
      prisma.$queryRaw.mockResolvedValue([]);

      const stats = await service.getStatistics();
      expect(stats.totalStockValue).toBe(5000);
    });
  });
});
