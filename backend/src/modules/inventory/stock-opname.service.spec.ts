import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockOpnameService } from './stock-opname.service';

type Mock<T> = { [K in keyof T]: jest.Mock };

describe('StockOpnameService', () => {
  let service: StockOpnameService;
  let prisma: any;
  let tx: any;

  const warehouse = {
    id: 'wh-outlet-1',
    outletId: 'branch-1',
    type: 'GOOD',
    scope: 'OUTLET',
    isActive: true,
    createdAt: new Date(),
  };

  const product = {
    id: 'prod-1',
    name: 'Indomie Goreng',
    sku: 'SKU-0001',
    barcode: '8991002101234',
    costPrice: new Decimal(2500),
    isActive: true,
    deletedAt: null,
  };

  const opname = (overrides: any = {}) => ({
    id: 'op-1',
    opnameNumber: 'OP-20260821-123456',
    warehouseId: 'wh-outlet-1',
    branchId: 'branch-1',
    status: 'counting',
    startedBy: 'user-1',
    ...overrides,
  });

  beforeEach(async () => {
    tx = {
      stockOpname: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      stockOpnameItem: {
        update: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      productStock: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: {
        create: jest.fn(),
      },
    };

    prisma = {
      warehouse: { findUnique: jest.fn(), findFirst: jest.fn() },
      stockOpname: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      productStock: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      product: { findFirst: jest.fn() },
      stockOpnameItem: {
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: { create: jest.fn() },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockOpnameService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<StockOpnameService>(StockOpnameService);
  });

  describe('startOpname', () => {
    it('resolves warehouse from warehouseId and snapshots products with stock', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse);
      prisma.stockOpname.findFirst.mockResolvedValue(null);
      prisma.productStock.findMany.mockResolvedValue([
        { productId: 'prod-1', quantityAvailable: new Decimal(10) },
        { productId: 'prod-2', quantityAvailable: new Decimal(5) },
      ]);
      tx.stockOpname.create.mockResolvedValue({ id: 'op-1' });
      tx.stockOpname.update.mockResolvedValue({ id: 'op-1', status: 'counting' });

      await service.startOpname(
        { warehouseId: 'wh-outlet-1', opnameDate: '2026-08-21' },
        'user-1',
      );

      expect(prisma.stockOpname.findFirst).toHaveBeenCalledWith({
        where: {
          warehouseId: 'wh-outlet-1',
          status: { in: ['draft', 'counting'] },
        },
      });
      const createData = tx.stockOpname.create.mock.calls[0][0].data;
      expect(createData.items.create).toHaveLength(2);
      expect(createData.items.create[0].systemQuantity.toString()).toBe('10');
      expect(createData.items.create[0].physicalQuantity).toBeNull();
      expect(createData.status).toBe('draft');
      expect(tx.stockOpname.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'counting' } }),
      );
    });

    it('resolves the GOOD OUTLET warehouse from a legacy branchId', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(warehouse);
      prisma.stockOpname.findFirst.mockResolvedValue(null);
      prisma.productStock.findMany.mockResolvedValue([]);
      tx.stockOpname.create.mockResolvedValue({ id: 'op-1' });
      tx.stockOpname.update.mockResolvedValue({});

      await service.startOpname(
        { branchId: 'branch-1', opnameDate: '2026-08-21' },
        'user-1',
      );

      expect(prisma.warehouse.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ outletId: 'branch-1', type: 'GOOD' }),
        }),
      );
    });

    it('rejects when an active opname exists for the warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(warehouse);
      prisma.stockOpname.findFirst.mockResolvedValue(opname());

      await expect(
        service.startOpname(
          { warehouseId: 'wh-outlet-1', opnameDate: '2026-08-21' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an inactive warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ ...warehouse, isActive: false });

      await expect(
        service.startOpname(
          { warehouseId: 'wh-outlet-1', opnameDate: '2026-08-21' },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('addItem (draft model)', () => {
    it('adds a product using live stock as system quantity', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(opname());
      prisma.product.findFirst.mockResolvedValue(product);
      prisma.stockOpnameItem.findFirst.mockResolvedValue(null);
      prisma.productStock.findUnique.mockResolvedValue({
        quantityAvailable: new Decimal(7),
      });
      prisma.stockOpnameItem.create.mockResolvedValue({ id: 'item-new' });
      // findById follow-up
      prisma.stockOpname.findUnique.mockResolvedValueOnce(opname());
      prisma.productStock.findMany.mockResolvedValue([]);

      await service.addItem('op-1', 'prod-1', 'user-1');

      const createData = prisma.stockOpnameItem.create.mock.calls[0][0].data;
      expect(createData.productId).toBe('prod-1');
      expect(createData.systemQuantity.toString()).toBe('7');
      expect(createData.physicalQuantity).toBeNull();
    });

    it('uses 0 as system quantity when no stock row exists', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(opname());
      prisma.product.findFirst.mockResolvedValue(product);
      prisma.stockOpnameItem.findFirst.mockResolvedValue(null);
      prisma.productStock.findUnique.mockResolvedValue(null);
      prisma.stockOpnameItem.create.mockResolvedValue({ id: 'item-new' });
      prisma.productStock.findMany.mockResolvedValue([]);

      await service.addItem('op-1', 'prod-1', 'user-1');

      expect(prisma.stockOpnameItem.create.mock.calls[0][0].data.systemQuantity.toString()).toBe('0');
    });

    it('rejects duplicate products', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(opname());
      prisma.product.findFirst.mockResolvedValue(product);
      prisma.stockOpnameItem.findFirst.mockResolvedValue({ id: 'item-1' });

      await expect(service.addItem('op-1', 'prod-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects adding to a non-active opname', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(opname({ status: 'approved' }));

      await expect(service.addItem('op-1', 'prod-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects unknown/inactive products', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(opname());
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(service.addItem('op-1', 'prod-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('removeItem (draft model)', () => {
    it('removes an existing item', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(opname());
      prisma.stockOpnameItem.findFirst.mockResolvedValue({ id: 'item-1' });
      prisma.productStock.findMany.mockResolvedValue([]);

      await service.removeItem('op-1', 'prod-1');

      expect(prisma.stockOpnameItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });

    it('rejects removal of a product not in the opname', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(opname());
      prisma.stockOpnameItem.findFirst.mockResolvedValue(null);

      await expect(service.removeItem('op-1', 'prod-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects removal after the opname is completed', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(opname({ status: 'completed' }));

      await expect(service.removeItem('op-1', 'prod-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancelOpname', () => {
    it('cancels an active opname with user + timestamp', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(opname());
      prisma.stockOpname.update.mockResolvedValue({ id: 'op-1', status: 'cancelled' });

      await service.cancelOpname('op-1', 'user-2');

      const data = prisma.stockOpname.update.mock.calls[0][0].data;
      expect(data.status).toBe('cancelled');
      expect(data.cancelledBy).toBe('user-2');
      expect(data.cancelledAt).toBeInstanceOf(Date);
    });

    it('rejects cancelling an approved opname', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(opname({ status: 'approved' }));

      await expect(service.cancelOpname('op-1', 'user-2')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('recordCount', () => {
    const countingOpname = () =>
      opname({
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            systemQuantity: new Decimal(10),
            product: { costPrice: new Decimal(2500) },
          },
        ],
      });

    it('captures LIVE stock at count time and computes discrepancy', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(countingOpname());
      tx.productStock.findUnique.mockResolvedValue({
        quantityAvailable: new Decimal(8),
      });
      tx.stockOpnameItem.update.mockResolvedValue({});
      tx.stockOpname.findUnique.mockResolvedValue({ id: 'op-1' });

      await service.recordCount(
        'op-1',
        { items: [{ productId: 'prod-1', physicalQuantity: 9 }] },
        'user-1',
      );

      const data = tx.stockOpnameItem.update.mock.calls[0][0].data;
      expect(data.physicalQuantity.toString()).toBe('9');
      // discrepancy = physical(9) - snapshot(10)
      expect(data.discrepancy.toString()).toBe('-1');
      expect(data.discrepancyValue.toString()).toBe('-2500');
      // live at count = 8 (2 already sold during the opname)
      expect(data.systemQuantityAtCount.toString()).toBe('8');
      expect(data.countedBy).toBe('user-1');
    });

    it('records 0 as live-at-count when no stock row exists', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(countingOpname());
      tx.productStock.findUnique.mockResolvedValue(null);
      tx.stockOpnameItem.update.mockResolvedValue({});
      tx.stockOpname.findUnique.mockResolvedValue({ id: 'op-1' });

      await service.recordCount(
        'op-1',
        { items: [{ productId: 'prod-1', physicalQuantity: 5 }] },
        'user-1',
      );

      expect(
        tx.stockOpnameItem.update.mock.calls[0][0].data.systemQuantityAtCount.toString(),
      ).toBe('0');
    });

    it('rejects recording counts when not counting', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(opname({ status: 'approved' }));

      await expect(
        service.recordCount(
          'op-1',
          { items: [{ productId: 'prod-1', physicalQuantity: 9 }] },
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordCount per-condition rows (IGDERP-175)', () => {
    const row = (overrides: any = {}) => ({
      id: 'item-1',
      productId: 'prod-1',
      systemQuantity: new Decimal(10),
      physicalQuantity: null,
      condition: null,
      product: { costPrice: new Decimal(2500) },
      ...overrides,
    });

    it('claims the uncounted snapshot row on the first condition scan (no duplicate)', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(
        opname({ items: [row({ id: 'item-1', physicalQuantity: null, condition: null })] }),
      );
      tx.productStock.findUnique.mockResolvedValue({ quantityAvailable: new Decimal(10) });
      tx.stockOpnameItem.update.mockResolvedValue({});
      tx.stockOpname.findUnique.mockResolvedValue({ id: 'op-1' });

      await service.recordCount(
        'op-1',
        { items: [{ productId: 'prod-1', physicalQuantity: 7, condition: 'good' }] },
        'user-1',
      );

      expect(tx.stockOpnameItem.create).not.toHaveBeenCalled();
      expect(tx.stockOpnameItem.update).toHaveBeenCalledTimes(1);
      expect(tx.stockOpnameItem.update.mock.calls[0][0].where.id).toBe('item-1');
      expect(tx.stockOpnameItem.update.mock.calls[0][0].data.condition).toBe('good');
    });

    it('creates a second row when the condition is new', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(
        opname({ items: [row({ id: 'item-1', physicalQuantity: new Decimal(10), condition: 'good' })] }),
      );
      tx.productStock.findUnique.mockResolvedValue({ quantityAvailable: new Decimal(10) });
      tx.stockOpnameItem.create.mockResolvedValue({ id: 'item-2' });
      tx.stockOpnameItem.update.mockResolvedValue({});
      tx.stockOpname.findUnique.mockResolvedValue({ id: 'op-1' });

      await service.recordCount(
        'op-1',
        { items: [{ productId: 'prod-1', physicalQuantity: 2, condition: 'damaged' }] },
        'user-1',
      );

      expect(tx.stockOpnameItem.create).toHaveBeenCalledTimes(1);
      expect(tx.stockOpnameItem.create.mock.calls[0][0].data.condition).toBe('damaged');
      expect(tx.stockOpnameItem.update).toHaveBeenCalledTimes(1);
    });

    it('409s on same-condition re-scan without force', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(
        opname({ items: [row({ physicalQuantity: new Decimal(10), condition: 'good' })] }),
      );

      await expect(
        service.recordCount(
          'op-1',
          { items: [{ productId: 'prod-1', physicalQuantity: 10, condition: 'good' }] },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(tx.stockOpnameItem.update).not.toHaveBeenCalled();
    });

    it('overwrites a counted row when force:true (explicit correction)', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(
        opname({ items: [row({ physicalQuantity: new Decimal(10), condition: 'good' })] }),
      );
      tx.productStock.findUnique.mockResolvedValue({ quantityAvailable: new Decimal(10) });
      tx.stockOpnameItem.update.mockResolvedValue({});
      tx.stockOpname.findUnique.mockResolvedValue({ id: 'op-1' });

      await service.recordCount(
        'op-1',
        { items: [{ productId: 'prod-1', physicalQuantity: 11, condition: 'good', force: true }] },
        'user-2',
      );

      const data = tx.stockOpnameItem.update.mock.calls[0][0].data;
      expect(data.physicalQuantity.toString()).toBe('11');
      expect(data.countedBy).toBe('user-2');
    });

    it('requires condition when the product already has multiple rows', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(
        opname({
          items: [
            row({ id: 'item-1', condition: 'good' }),
            row({ id: 'item-2', condition: 'damaged' }),
          ],
        }),
      );

      await expect(
        service.recordCount('op-1', { items: [{ productId: 'prod-1', physicalQuantity: 1 }] }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('completeOpname', () => {
    it('rejects when items remain uncounted', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(
        opname({
          items: [
            { id: 'i1', physicalQuantity: new Decimal(5), discrepancyValue: new Decimal(0) },
            { id: 'i2', physicalQuantity: null, discrepancyValue: null },
          ],
        }),
      );

      await expect(service.completeOpname('op-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('completes with total discrepancy value', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(
        opname({
          items: [
            { id: 'i1', physicalQuantity: new Decimal(5), discrepancyValue: new Decimal(-2500) },
            { id: 'i2', physicalQuantity: new Decimal(3), discrepancyValue: new Decimal(5000) },
          ],
        }),
      );
      prisma.stockOpname.update.mockResolvedValue({ id: 'op-1', status: 'completed' });

      await service.completeOpname('op-1', 'user-1');

      const data = prisma.stockOpname.update.mock.calls[0][0].data;
      expect(data.status).toBe('completed');
      expect(data.totalDiscrepancyValue.toString()).toBe('2500');
      expect(data.completedBy).toBe('user-1');
    });
  });

  describe('approveOpname (sale-safe reconciliation)', () => {
    const completedOpname = (items: any[]) =>
      opname({
        status: 'completed',
        items: items.map((i) => ({ product: { costPrice: new Decimal(1000) }, ...i })),
      });

    it('preserves sales that happened during the opname (counted 2, sold 1 → 1)', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(
        completedOpname([
          {
            id: 'i1',
            productId: 'prod-1',
            systemQuantity: new Decimal(2),
            systemQuantityAtCount: new Decimal(2),
            physicalQuantity: new Decimal(2),
            discrepancy: new Decimal(0),
            condition: 'good',
          },
        ]),
      );
      tx.productStock.findUnique.mockResolvedValue({
        quantityAvailable: new Decimal(1), // 1 sold after the count
        quantityDamaged: new Decimal(0),
      });
      tx.productStock.update.mockResolvedValue({});
      tx.stockOpname.update.mockResolvedValue({ id: 'op-1', status: 'approved' });

      await service.approveOpname('op-1', 'spv-1');

      const updateData = tx.productStock.update.mock.calls[0][0].data;
      // final = physical(2) + live(1) - liveAtCount(2) = 1
      expect(updateData.quantityAvailable.toString()).toBe('1');
      // change vs live = 0 → no adjustment movement needed (the POS sale already moved stock)
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('applies the physical discrepancy when no sales happened (10 → counted 7)', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(
        completedOpname([
          {
            id: 'i1',
            productId: 'prod-1',
            systemQuantity: new Decimal(10),
            systemQuantityAtCount: new Decimal(10),
            physicalQuantity: new Decimal(7),
            discrepancy: new Decimal(-3),
            condition: 'good',
          },
        ]),
      );
      tx.productStock.findUnique.mockResolvedValue({
        quantityAvailable: new Decimal(10),
        quantityDamaged: new Decimal(0),
      });
      tx.productStock.update.mockResolvedValue({});
      tx.stockOpname.update.mockResolvedValue({});

      await service.approveOpname('op-1', 'spv-1');

      const updateData = tx.productStock.update.mock.calls[0][0].data;
      expect(updateData.quantityAvailable.toString()).toBe('7');
      const movement = tx.stockMovement.create.mock.calls[0][0].data;
      expect(movement.quantityChange.toString()).toBe('-3');
    });

    it('falls back to physical when systemQuantityAtCount is null (legacy data)', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(
        completedOpname([
          {
            id: 'i1',
            productId: 'prod-1',
            systemQuantity: new Decimal(10),
            systemQuantityAtCount: null,
            physicalQuantity: new Decimal(12),
            discrepancy: new Decimal(2),
            condition: 'good',
          },
        ]),
      );
      tx.productStock.findUnique.mockResolvedValue({
        quantityAvailable: new Decimal(10),
        quantityDamaged: new Decimal(0),
      });
      tx.productStock.update.mockResolvedValue({});
      tx.stockOpname.update.mockResolvedValue({});

      await service.approveOpname('op-1', 'spv-1');

      expect(tx.productStock.update.mock.calls[0][0].data.quantityAvailable.toString()).toBe('12');
    });

    it('reclassifies damaged units even with zero discrepancy (10 counted, all damaged)', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(
        completedOpname([
          {
            id: 'i1',
            productId: 'prod-1',
            systemQuantity: new Decimal(10),
            systemQuantityAtCount: new Decimal(10),
            physicalQuantity: new Decimal(10),
            discrepancy: new Decimal(0),
            condition: 'damaged',
          },
        ]),
      );
      tx.productStock.findUnique.mockResolvedValue({
        quantityAvailable: new Decimal(10),
        quantityDamaged: new Decimal(0),
      });
      tx.productStock.update.mockResolvedValue({});
      tx.stockOpname.update.mockResolvedValue({});

      await service.approveOpname('op-1', 'spv-1');

      const updateData = tx.productStock.update.mock.calls[0][0].data;
      // available = final(10) - physical(10) = 0; damaged = 0 + 10 = 10
      expect(updateData.quantityAvailable.toString()).toBe('0');
      expect(updateData.quantityDamaged.toString()).toBe('10');
      // movement still created for the reclassification
      expect(tx.stockMovement.create).toHaveBeenCalled();
      const movement = tx.stockMovement.create.mock.calls[0][0].data;
      expect(movement.notes).toContain('damaged');
    });

    it('creates a zero stock row when the product has none', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(
        completedOpname([
          {
            id: 'i1',
            productId: 'prod-new',
            systemQuantity: new Decimal(0),
            systemQuantityAtCount: new Decimal(0),
            physicalQuantity: new Decimal(4),
            discrepancy: new Decimal(4),
            condition: 'good',
          },
        ]),
      );
      tx.productStock.findUnique.mockResolvedValue(null);
      tx.productStock.create.mockResolvedValue({
        quantityAvailable: new Decimal(0),
        quantityDamaged: new Decimal(0),
      });
      tx.productStock.update.mockResolvedValue({});
      tx.stockOpname.update.mockResolvedValue({});

      await service.approveOpname('op-1', 'spv-1');

      expect(tx.productStock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ productId: 'prod-new' }),
        }),
      );
      expect(tx.productStock.update.mock.calls[0][0].data.quantityAvailable.toString()).toBe('4');
    });

    it('rejects approval when not completed', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(opname({ status: 'counting' }));

      await expect(service.approveOpname('op-1', 'spv-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findById', () => {
    it('attaches live quantities from product_stock', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(
        opname({
          items: [
            {
              id: 'i1',
              productId: 'prod-1',
              product: { name: 'X' },
            },
            {
              id: 'i2',
              productId: 'prod-2',
              product: { name: 'Y' },
            },
          ],
        }),
      );
      prisma.productStock.findMany.mockResolvedValue([
        { productId: 'prod-1', quantityAvailable: new Decimal(3) },
      ]);

      const result = await service.findById('op-1');

      expect(result.items[0].liveQuantity.toString()).toBe('3');
      expect(result.items[1].liveQuantity.toString()).toBe('0');
    });

    it('throws when not found', async () => {
      prisma.stockOpname.findUnique.mockResolvedValue(null);

      await expect(service.findById('op-1')).rejects.toThrow(NotFoundException);
    });
  });
});
