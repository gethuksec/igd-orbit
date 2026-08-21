import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockOutService } from './stock-out.service';
import { CreateStockOutDto } from './dto/create-stock-out.dto';

describe('StockOutService', () => {
  let service: StockOutService;
  let prisma: {
    branch: { findUnique: jest.Mock };
    warehouse: { findUnique: jest.Mock; findMany: jest.Mock };
    product: { findMany: jest.Mock };
    unit: { findMany: jest.Mock };
    productStock: { findMany: jest.Mock };
    stockOut: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    stockOut: { create: jest.Mock; update: jest.Mock };
    productStock: { findUnique: jest.Mock; update: jest.Mock };
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
  const centralBad = {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'CENTRAL-BAD',
    name: 'Central Bad Stock',
    type: 'BAD',
    scope: 'SYSTEM',
    outletId: null,
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

  const baseDto: CreateStockOutDto = {
    outletId: 'outlet-1',
    warehouseId: 'wh-1',
    date: '2026-08-21',
    reason: 'Barang kadaluarsa',
    items: [{ productId: 'prod-1', quantity: 2 }],
  };

  const stockRow = {
    id: 'ps-1',
    productId: 'prod-1',
    warehouseId: 'wh-1',
    quantityAvailable: new Decimal(10),
  };

  beforeEach(async () => {
    tx = {
      stockOut: {
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'stockout-1',
          documentNumber: 'SOUT-20260821-123456',
          ...args.data,
        })),
        update: jest.fn().mockImplementation(async (args: any) => ({
          id: 'stockout-1',
          documentNumber: 'SOUT-20260821-123456',
          outletId: 'outlet-1',
          warehouseId: 'wh-1',
          reason: 'Barang kadaluarsa',
          totalValue: args.data.totalValue,
          items: [{ id: 'item-1', productId: 'prod-1', quantity: new Decimal(2), stockValue: new Decimal(10000), lineTotal: new Decimal(20000) }],
        })),
      },
      productStock: {
        findUnique: jest.fn().mockResolvedValue(stockRow),
        update: jest.fn().mockResolvedValue({ id: 'ps-1' }),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'sm-1' }) },
    };

    prisma = {
      branch: { findUnique: jest.fn().mockResolvedValue(outlet) },
      warehouse: {
        findUnique: jest.fn().mockResolvedValue(goodWarehouse),
        findMany: jest.fn().mockResolvedValue([]),
      },
      product: { findMany: jest.fn().mockResolvedValue([product]) },
      unit: { findMany: jest.fn().mockResolvedValue([unit]) },
      productStock: { findMany: jest.fn().mockResolvedValue([]) },
      stockOut: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockOutService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StockOutService>(StockOutService);
  });

  describe('create — validation', () => {
    it('rejects empty items', async () => {
      await expect(
        service.create({ ...baseDto, items: [] }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a missing outlet for an outlet GOOD warehouse', async () => {
      await expect(
        service.create({ ...baseDto, outletId: undefined }, 'user-1'),
      ).rejects.toThrow('Outlet is required for an outlet warehouse');
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

    it('rejects a BAD outlet-scoped warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({
        ...goodWarehouse,
        type: 'BAD',
        scope: 'OUTLET',
      });
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        'Selected warehouse must be an outlet GOOD warehouse or the Central Bad Stock warehouse',
      );
    });

    it('rejects an inactive warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({
        ...goodWarehouse,
        isActive: false,
      });
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        'Cannot remove stock from an inactive warehouse',
      );
    });

    it('rejects an unknown warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects an unknown product', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create — Central Bad Stock (system scope, no outlet)', () => {
    it('accepts the system-scoped Central Bad Stock warehouse without an outlet', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(centralBad);
      await service.create(
        { ...baseDto, outletId: undefined, warehouseId: centralBad.id },
        'user-1',
      );
      const created = tx.stockOut.create.mock.calls[0][0].data;
      expect(created.outletId).toBeNull();
      expect(created.warehouseId).toBe(centralBad.id);
      expect(prisma.branch.findUnique).not.toHaveBeenCalled();
    });

    it('stores outletId as null even when an outlet is passed with Central Bad Stock', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(centralBad);
      await service.create(
        { ...baseDto, warehouseId: centralBad.id },
        'user-1',
      );
      const created = tx.stockOut.create.mock.calls[0][0].data;
      expect(created.outletId).toBeNull();
      const movement = tx.stockMovement.create.mock.calls[0][0].data;
      expect(movement.branchId).toBeNull();
      expect(movement.warehouseId).toBe(centralBad.id);
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

      const createdItems = tx.stockOut.create.mock.calls[0][0].data.items.create;
      expect(createdItems).toHaveLength(1);
      expect(Number(createdItems[0].quantity)).toBe(7);
      // Single stock movement with merged quantity
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
      expect(Number(tx.stockMovement.create.mock.calls[0][0].data.quantityChange)).toBe(-7);
      expect(result.totalValue).toBe(70000);
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
      const createdItems = tx.stockOut.create.mock.calls[0][0].data.items.create;
      expect(Number(createdItems[0].stockValue)).toBe(9000);
      expect(Number(createdItems[0].lineTotal)).toBe(45000);
    });
  });

  describe('create — stock value defaults', () => {
    it('defaults stockValue from Product.minSellingPrice', async () => {
      await service.create(baseDto, 'user-1');
      const createdItems = tx.stockOut.create.mock.calls[0][0].data.items.create;
      expect(Number(createdItems[0].stockValue)).toBe(10000);
    });

    it('falls back to sellingPrice when minSellingPrice is null', async () => {
      prisma.product.findMany.mockResolvedValue([
        { ...product, minSellingPrice: null },
      ]);
      await service.create(baseDto, 'user-1');
      const createdItems = tx.stockOut.create.mock.calls[0][0].data.items.create;
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
      const createdItems = tx.stockOut.create.mock.calls[0][0].data.items.create;
      expect(Number(createdItems[0].stockValue)).toBe(8500);
    });

    it('defaults unitId from the product unit', async () => {
      await service.create(baseDto, 'user-1');
      const createdItems = tx.stockOut.create.mock.calls[0][0].data.items.create;
      expect(createdItems[0].unitId).toBe('unit-1');
      expect(createdItems[0].unitName).toBe('pcs');
    });
  });

  describe('create — insufficient stock', () => {
    it('rejects when no stock row exists for the product+warehouse', async () => {
      tx.productStock.findUnique.mockResolvedValue(null);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        /Insufficient stock for "iPhone 15" \(available: 0, requested: 2\)/,
      );
      expect(tx.stockOut.create).toHaveBeenCalledTimes(1); // rolled back by caller
      expect(tx.productStock.update).not.toHaveBeenCalled();
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('rejects when requested quantity exceeds available quantity', async () => {
      tx.productStock.findUnique.mockResolvedValue({
        ...stockRow,
        quantityAvailable: new Decimal(1),
      });
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        /Insufficient stock for "iPhone 15" \(available: 1, requested: 2\)/,
      );
      expect(tx.productStock.update).not.toHaveBeenCalled();
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('rejects the whole document when one of several lines is short', async () => {
      prisma.product.findMany.mockResolvedValue([
        product,
        { ...product, id: 'prod-2', name: 'Samsung S24', sku: 'SS-S24' },
      ]);
      tx.productStock.findUnique
        .mockResolvedValueOnce({ ...stockRow, productId: 'prod-1', quantityAvailable: new Decimal(5) })
        .mockResolvedValueOnce({ ...stockRow, productId: 'prod-2', quantityAvailable: new Decimal(1) });
      await expect(
        service.create(
          {
            ...baseDto,
            items: [
              { productId: 'prod-1', quantity: 2 },
              { productId: 'prod-2', quantity: 3 },
            ],
          },
          'user-1',
        ),
      ).rejects.toThrow(/Insufficient stock for "Samsung S24"/);
      // Inline mock tx runs the callback without rollback, so only the first
      // line's writes were attempted; the failing line never wrote a movement.
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
      expect(tx.stockMovement.create.mock.calls[0][0].data.productId).toBe('prod-1');
      expect(tx.productStock.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('create — atomic stock writes', () => {
    it('decrements the ProductStock row and writes a negative OUT movement', async () => {
      await service.create(baseDto, 'user-1');

      expect(tx.productStock.update).toHaveBeenCalledTimes(1);
      const updated = tx.productStock.update.mock.calls[0][0].data;
      expect(Number(updated.quantityAvailable)).toBe(8);

      expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
      const movement = tx.stockMovement.create.mock.calls[0][0].data;
      expect(movement.movementType).toBe('OUT');
      expect(movement.referenceType).toBe('STOCK_OUT');
      expect(movement.referenceId).toBe('stockout-1');
      expect(movement.warehouseId).toBe('wh-1');
      expect(movement.branchId).toBe('outlet-1');
      expect(Number(movement.quantityChange)).toBe(-2);
      expect(Number(movement.quantityBefore)).toBe(10);
      expect(Number(movement.quantityAfter)).toBe(8);
      expect(movement.createdBy).toBe('user-1');
      expect(movement.notes).toMatch(/^Stock Out: SOUT-\d{8}-\d{6} - Barang kadaluarsa$/);
    });

    it('computes totalValue as sum(qty * stockValue)', async () => {
      prisma.product.findMany.mockResolvedValue([
        product,
        { ...product, id: 'prod-2', name: 'Samsung S24', sku: 'SS-S24' },
      ]);
      tx.productStock.findUnique
        .mockResolvedValueOnce({ ...stockRow, productId: 'prod-1', quantityAvailable: new Decimal(10) })
        .mockResolvedValueOnce({ ...stockRow, productId: 'prod-2', quantityAvailable: new Decimal(10) });
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
      expect(result.totalValue).toBe(65000);
    });

    it('generates a SOUT-YYYYMMDD-XXXXXX document number', async () => {
      await service.create(baseDto, 'user-1');
      const created = tx.stockOut.create.mock.calls[0][0].data;
      expect(created.documentNumber).toMatch(/^SOUT-\d{8}-\d{6}$/);
    });

    it('never touches GL, cash, sales or purchase models', async () => {
      await service.create(baseDto, 'user-1');
      const touched: string[] = [];
      for (const group of Object.values(tx)) {
        for (const [method, fn] of Object.entries(group)) {
          if (typeof fn === 'function' && (fn as jest.Mock).mock?.calls.length > 0) {
            touched.push(`${group === tx.stockOut ? 'stockOut' : group === tx.productStock ? 'productStock' : 'stockMovement'}.${method}`);
          }
        }
      }
      expect(touched.sort()).toEqual([
        'productStock.findUnique',
        'productStock.update',
        'stockMovement.create',
        'stockOut.create',
        'stockOut.update',
      ]);
    });
  });

  describe('findById', () => {
    it('throws 404 when the document does not exist', async () => {
      prisma.stockOut.findUnique.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the document with numeric fields', async () => {
      prisma.stockOut.findUnique.mockResolvedValue({
        id: 'stockout-1',
        documentNumber: 'SOUT-20260821-123456',
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
      const doc = await service.findById('stockout-1');
      expect(doc.totalValue).toBe(50000);
      expect(doc.items[0].quantity).toBe(5);
    });
  });

  describe('supporting lists', () => {
    it('findSourceWarehouses returns GOOD outlet warehouses plus Central Bad Stock', async () => {
      prisma.warehouse.findMany
        .mockResolvedValueOnce([goodWarehouse])
        .mockResolvedValueOnce([centralBad]);
      const results = await service.findSourceWarehouses('outlet-1');
      expect(prisma.warehouse.findMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            type: 'GOOD',
            scope: 'OUTLET',
            isActive: true,
            outletId: 'outlet-1',
          }),
        }),
      );
      expect(prisma.warehouse.findMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({ type: 'BAD', scope: 'SYSTEM', isActive: true }),
        }),
      );
      expect(results).toHaveLength(2);
      expect(results[1].code).toBe('CENTRAL-BAD');
    });

    it('searchProducts attaches availableQuantity per warehouse', async () => {
      prisma.product.findMany.mockResolvedValue([
        { ...product, memberPricing: { 'tier-1': 11000 } },
      ]);
      prisma.productStock.findMany.mockResolvedValue([
        { productId: 'prod-1', quantityAvailable: new Decimal(7) },
      ]);
      const results = await service.searchProducts('iphone', 15, 'wh-1');
      expect(results[0].sellingPrice).toBe(12000);
      expect(results[0].minSellingPrice).toBe(10000);
      expect(results[0].availableQuantity).toBe(7);
      expect(prisma.productStock.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ warehouseId: 'wh-1' }),
        }),
      );
    });

    it('searchProducts reports 0 available when no warehouse is given or row missing', async () => {
      prisma.product.findMany.mockResolvedValue([product]);
      const withoutWh = await service.searchProducts('iphone');
      expect(withoutWh[0].availableQuantity).toBe(0);
      expect(prisma.productStock.findMany).not.toHaveBeenCalled();

      prisma.productStock.findMany.mockResolvedValue([]);
      const withWh = await service.searchProducts('iphone', 15, 'wh-1');
      expect(withWh[0].availableQuantity).toBe(0);
    });
  });
});
