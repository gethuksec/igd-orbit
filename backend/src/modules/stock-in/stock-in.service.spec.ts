import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockInService, NO_SUPPLIER } from './stock-in.service';
import { CreateStockInDto } from './dto/create-stock-in.dto';

describe('StockInService', () => {
  let service: StockInService;
  let prisma: {
    branch: { findUnique: jest.Mock };
    warehouse: { findUnique: jest.Mock; findMany: jest.Mock };
    customer: { findUnique: jest.Mock };
    product: { findMany: jest.Mock };
    unit: { findMany: jest.Mock };
    stockIn: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    customerTier: { findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    stockIn: { create: jest.Mock; update: jest.Mock };
    productStock: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    stockMovement: { create: jest.Mock };
  };

  const outlet = { id: 'outlet-1', name: 'Kalisat', code: 'KLS' };
  const goodWarehouse = {
    id: 'wh-1',
    code: 'KLS-GDG',
    name: 'Kalisat – Gudang',
    type: 'GOOD',
    scope: 'OUTLET',
    outletId: 'outlet-1',
    isActive: true,
  };
  const product = {
    id: 'prod-1',
    name: 'iPhone 15',
    sku: 'IP15-128',
    sellingPrice: new Decimal(12000),
    minSellingPrice: new Decimal(10000),
    unitId: 'unit-1',
    unit: { id: 'unit-1', name: 'pcs' },
  };
  const unit = { id: 'unit-1', name: 'pcs' };

  const baseDto: CreateStockInDto = {
    outletId: 'outlet-1',
    warehouseId: 'wh-1',
    supplierId: undefined,
    date: '2026-08-21',
    reason: 'Stok awal toko',
    items: [{ productId: 'prod-1', quantity: 5 }],
  };

  beforeEach(async () => {
    tx = {
      stockIn: {
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'stockin-1',
          documentNumber: 'SIN-20260821-123456',
          ...args.data,
        })),
        update: jest.fn().mockImplementation(async (args: any) => ({
          id: 'stockin-1',
          documentNumber: 'SIN-20260821-123456',
          outletId: 'outlet-1',
          warehouseId: 'wh-1',
          supplierId: NO_SUPPLIER,
          reason: 'Stok awal toko',
          totalValue: args.data.totalValue,
          items: [{ id: 'item-1', productId: 'prod-1', quantity: new Decimal(5), stockValue: new Decimal(10000), lineTotal: new Decimal(50000) }],
        })),
      },
      productStock: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'ps-1' }),
        create: jest.fn().mockResolvedValue({ id: 'ps-1' }),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'sm-1' }) },
    };

    prisma = {
      branch: { findUnique: jest.fn().mockResolvedValue(outlet) },
      warehouse: {
        findUnique: jest.fn().mockResolvedValue(goodWarehouse),
        findMany: jest.fn().mockResolvedValue([goodWarehouse]),
      },
      customer: { findUnique: jest.fn().mockResolvedValue(null) },
      product: { findMany: jest.fn().mockResolvedValue([product]) },
      unit: { findMany: jest.fn().mockResolvedValue([unit]) },
      stockIn: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      customerTier: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockInService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StockInService>(StockInService);
  });

  describe('create — validation', () => {
    it('rejects empty items', async () => {
      await expect(
        service.create({ ...baseDto, items: [] }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a warehouse that does not belong to the outlet', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({
        ...goodWarehouse,
        outletId: 'outlet-other',
      });
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        'Selected warehouse must belong to the selected outlet',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a BAD warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({
        ...goodWarehouse,
        type: 'BAD',
      });
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        'Selected warehouse must be a GOOD outlet warehouse',
      );
    });

    it('rejects an inactive warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({
        ...goodWarehouse,
        isActive: false,
      });
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        'Cannot receive stock in an inactive warehouse',
      );
    });

    it('rejects a non-wholesale supplier', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'sup-1',
        name: 'PT Retail',
        customerType: 'retail',
      });
      await expect(
        service.create({ ...baseDto, supplierId: 'sup-1' }, 'user-1'),
      ).rejects.toThrow('Supplier not found');
    });

    it('rejects an unknown product', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create — duplicate merge', () => {
    it('merges duplicate product lines by summing quantity', async () => {
      const result = await service.create(
        {
          ...baseDto,
          items: [
            { productId: 'prod-1', quantity: 3 },
            { productId: 'prod-1', quantity: 4 },
          ],
        },
        'user-1',
      );

      const createdItems = tx.stockIn.create.mock.calls[0][0].data.items.create;
      expect(createdItems).toHaveLength(1);
      expect(Number(createdItems[0].quantity)).toBe(7);
      // Single stock movement with merged quantity
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
      expect(Number(tx.stockMovement.create.mock.calls[0][0].data.quantityChange)).toBe(7);
      expect(result.totalValue).toBe(70000); // serialized to number by create()
    });

    it('keeps the first explicit stockValue when merging', async () => {
      await service.create(
        {
          ...baseDto,
          items: [
            { productId: 'prod-1', quantity: 2, stockValue: 9000 },
            { productId: 'prod-1', quantity: 3 },
          ],
        },
        'user-1',
      );
      const createdItems = tx.stockIn.create.mock.calls[0][0].data.items.create;
      expect(Number(createdItems[0].stockValue)).toBe(9000);
      expect(Number(createdItems[0].lineTotal)).toBe(45000);
    });
  });

  describe('create — supplier sentinel', () => {
    it('persists NO_SUPPLIER when supplier is absent', async () => {
      await service.create(baseDto, 'user-1');
      const created = tx.stockIn.create.mock.calls[0][0].data;
      expect(created.supplierId).toBe(NO_SUPPLIER);
      expect(created.supplierName).toBeNull();
    });

    it('persists NO_SUPPLIER when the sentinel is passed explicitly', async () => {
      await service.create({ ...baseDto, supplierId: NO_SUPPLIER }, 'user-1');
      const created = tx.stockIn.create.mock.calls[0][0].data;
      expect(created.supplierId).toBe(NO_SUPPLIER);
    });

    it('persists a real supplier with a name snapshot', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'sup-1',
        name: 'PT Sumber Jaya',
        customerType: 'wholesale',
      });
      await service.create({ ...baseDto, supplierId: 'sup-1' }, 'user-1');
      const created = tx.stockIn.create.mock.calls[0][0].data;
      expect(created.supplierId).toBe('sup-1');
      expect(created.supplierName).toBe('PT Sumber Jaya');
    });
  });

  describe('create — stock value defaults', () => {
    it('defaults stockValue from Product.minSellingPrice', async () => {
      await service.create(baseDto, 'user-1');
      const createdItems = tx.stockIn.create.mock.calls[0][0].data.items.create;
      expect(Number(createdItems[0].stockValue)).toBe(10000);
    });

    it('falls back to sellingPrice when minSellingPrice is null', async () => {
      prisma.product.findMany.mockResolvedValue([
        { ...product, minSellingPrice: null },
      ]);
      await service.create(baseDto, 'user-1');
      const createdItems = tx.stockIn.create.mock.calls[0][0].data.items.create;
      expect(Number(createdItems[0].stockValue)).toBe(12000);
    });

    it('keeps an explicit stockValue', async () => {
      await service.create(
        {
          ...baseDto,
          items: [{ productId: 'prod-1', quantity: 2, stockValue: 8500 }],
        },
        'user-1',
      );
      const createdItems = tx.stockIn.create.mock.calls[0][0].data.items.create;
      expect(Number(createdItems[0].stockValue)).toBe(8500);
    });

    it('defaults unitId from the product unit', async () => {
      await service.create(baseDto, 'user-1');
      const createdItems = tx.stockIn.create.mock.calls[0][0].data.items.create;
      expect(createdItems[0].unitId).toBe('unit-1');
      expect(createdItems[0].unitName).toBe('pcs');
    });
  });

  describe('create — atomic stock writes', () => {
    it('creates a ProductStock row when absent and writes an IN movement', async () => {
      await service.create(baseDto, 'user-1');

      expect(tx.productStock.create).toHaveBeenCalledTimes(1);
      const createdStock = tx.productStock.create.mock.calls[0][0].data;
      expect(createdStock.productId).toBe('prod-1');
      expect(createdStock.warehouseId).toBe('wh-1');
      expect(createdStock.branchId).toBe('outlet-1');
      expect(Number(createdStock.quantityAvailable)).toBe(5);

      expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
      const movement = tx.stockMovement.create.mock.calls[0][0].data;
      expect(movement.movementType).toBe('IN');
      expect(movement.referenceType).toBe('STOCK_IN');
      expect(movement.referenceId).toBe('stockin-1');
      expect(movement.warehouseId).toBe('wh-1');
      expect(movement.branchId).toBe('outlet-1');
      expect(Number(movement.quantityChange)).toBe(5);
      expect(Number(movement.quantityBefore)).toBe(0);
      expect(Number(movement.quantityAfter)).toBe(5);
      expect(movement.createdBy).toBe('user-1');
      expect(movement.notes).toMatch(/^Stock In: SIN-\d{8}-\d{6} - Stok awal toko$/);
    });

    it('increments an existing ProductStock row', async () => {
      tx.productStock.findUnique.mockResolvedValue({
        id: 'ps-1',
        productId: 'prod-1',
        warehouseId: 'wh-1',
        quantityAvailable: new Decimal(10),
      });
      await service.create(baseDto, 'user-1');

      expect(tx.productStock.create).not.toHaveBeenCalled();
      expect(tx.productStock.update).toHaveBeenCalledTimes(1);
      const updated = tx.productStock.update.mock.calls[0][0].data;
      expect(Number(updated.quantityAvailable)).toBe(15);

      const movement = tx.stockMovement.create.mock.calls[0][0].data;
      expect(Number(movement.quantityBefore)).toBe(10);
      expect(Number(movement.quantityAfter)).toBe(15);
    });

    it('computes totalValue as sum(qty * stockValue)', async () => {
      prisma.product.findMany.mockResolvedValue([
        product,
        { ...product, id: 'prod-2', name: 'Samsung S24', sku: 'SS-S24' },
      ]);
      const result = await service.create(
        {
          ...baseDto,
          items: [
            { productId: 'prod-1', quantity: 2 },
            { productId: 'prod-2', quantity: 3, stockValue: 15000 },
          ],
        },
        'user-1',
      );
      expect(result.totalValue).toBe(65000); // serialized to number by create()
    });

    it('generates a SIN-YYYYMMDD-XXXXXX document number', async () => {
      await service.create(baseDto, 'user-1');
      const created = tx.stockIn.create.mock.calls[0][0].data;
      expect(created.documentNumber).toMatch(/^SIN-\d{8}-\d{6}$/);
    });

    it('never touches GL, cash, sales or purchase models', async () => {
      await service.create(baseDto, 'user-1');
      const touched: string[] = [];
      for (const group of Object.values(tx)) {
        for (const [method, fn] of Object.entries(group)) {
          if (typeof fn === 'function' && (fn as jest.Mock).mock?.calls.length > 0) {
            touched.push(`${group === tx.stockIn ? 'stockIn' : group === tx.productStock ? 'productStock' : 'stockMovement'}.${method}`);
          }
        }
      }
      expect(touched.sort()).toEqual([
        'productStock.create',
        'productStock.findUnique',
        'stockIn.create',
        'stockIn.update',
        'stockMovement.create',
      ]);
    });
  });

  describe('findById', () => {
    it('throws 404 when the document does not exist', async () => {
      prisma.stockIn.findUnique.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the document with numeric fields', async () => {
      prisma.stockIn.findUnique.mockResolvedValue({
        id: 'stockin-1',
        documentNumber: 'SIN-20260821-123456',
        totalValue: new Decimal(50000),
        items: [
          {
            id: 'item-1',
            quantity: new Decimal(5),
            stockValue: new Decimal(10000),
            lineTotal: new Decimal(50000),
          },
        ],
      });
      const doc = await service.findById('stockin-1');
      expect(doc.totalValue).toBe(50000);
      expect(doc.items[0].quantity).toBe(5);
    });
  });

  describe('supporting lists', () => {
    it('findGoodWarehouses filters to active GOOD outlet warehouses for the outlet', async () => {
      await service.findGoodWarehouses('outlet-1');
      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'GOOD',
            scope: 'OUTLET',
            isActive: true,
            outletId: 'outlet-1',
          }),
        }),
      );
    });

    it('searchProducts converts decimals and includes pricing defaults', async () => {
      prisma.product.findMany.mockResolvedValue([
        { ...product, memberPricing: { 'tier-1': 11000 } },
      ]);
      const results = await service.searchProducts('iphone');
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: expect.objectContaining({ contains: 'iphone' }) }),
            ]),
          }),
        }),
      );
      expect(results[0].sellingPrice).toBe(12000);
      expect(results[0].minSellingPrice).toBe(10000);
      expect(results[0].memberPricing).toEqual({ 'tier-1': 11000 });
    });

    it('getTiers returns active tiers ordered by level', async () => {
      const tiers = [
        { id: 't1', code: 'SILVER', name: 'Silver', level: 1 },
        { id: 't2', code: 'GOLD', name: 'Gold', level: 2 },
        { id: 't3', code: 'PLATINUM', name: 'Platinum', level: 3 },
      ];
      prisma.customerTier.findMany.mockResolvedValue(tiers);
      await expect(service.getTiers()).resolves.toEqual(tiers);
      expect(prisma.customerTier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true }, orderBy: { level: 'asc' } }),
      );
    });
  });
});
