import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { TransferStockService } from './transfer-stock.service';
import { CreateTransferStockDto } from './dto/create-transfer-stock.dto';

describe('TransferStockService', () => {
  let service: TransferStockService;
  let prisma: {
    branch: { findUnique: jest.Mock };
    warehouse: { findUnique: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
    product: { findMany: jest.Mock };
    user: { findMany: jest.Mock; findUnique: jest.Mock };
    productStock: { findMany: jest.Mock };
    stockTransfer: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tx: {
    stockTransfer: { create: jest.Mock; findUnique: jest.Mock };
    productStock: {
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    stockMovement: { create: jest.Mock };
  };

  const outletA = { id: 'outlet-a', name: 'Kalisat', code: 'KLS' };
  const outletB = { id: 'outlet-b', name: 'Jember', code: 'JBR' };
  const whA = {
    id: 'wh-a',
    code: 'KLS-GDG',
    name: 'Kalisat – Gudang',
    type: 'GOOD',
    scope: 'OUTLET',
    outletId: 'outlet-a',
    isActive: true,
  };
  const whB = {
    id: 'wh-b',
    code: 'JBR-GDG',
    name: 'Jember – Gudang',
    type: 'GOOD',
    scope: 'OUTLET',
    outletId: 'outlet-b',
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
    unitId: 'unit-1',
  };

  const stockRow = {
    id: 'ps-1',
    productId: 'prod-1',
    warehouseId: 'wh-a',
    quantityAvailable: new Decimal(10),
    quantityReserved: new Decimal(0),
    quantityDamaged: new Decimal(0),
  };

  const baseDto: CreateTransferStockDto = {
    outletId: 'outlet-a',
    warehouseId: 'wh-a',
    destinationMode: 'outlet',
    toOutletId: 'outlet-b',
    toWarehouseId: 'wh-b',
    notes: 'Rutin',
    items: [{ productId: 'prod-1', quantity: 2 }],
  };

  const createdTransfer = {
    id: 'transfer-1',
    transferNumber: 'TRF-20260821-123456',
    fromWarehouseId: 'wh-a',
    toWarehouseId: 'wh-b',
    fromBranchId: 'outlet-a',
    toBranchId: 'outlet-b',
    transferType: 'regular',
    status: 'completed',
    requestedBy: 'user-1',
    notes: 'Rutin',
    createdAt: new Date('2026-08-21T10:00:00Z'),
    updatedAt: new Date('2026-08-21T10:00:00Z'),
    items: [
      {
        id: 'item-1',
        transferId: 'transfer-1',
        productId: 'prod-1',
        productName: 'iPhone 15',
        productSku: 'IP15-128',
        quantityRequested: new Decimal(2),
        quantitySent: new Decimal(2),
        quantityReceived: new Decimal(2),
        notes: null,
        createdAt: new Date('2026-08-21T10:00:00Z'),
        updatedAt: new Date('2026-08-21T10:00:00Z'),
      },
    ],
    fromWarehouse: whA,
    toWarehouse: whB,
    fromBranch: outletA,
    toBranch: outletB,
  };

  beforeEach(async () => {
    tx = {
      stockTransfer: {
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'transfer-1',
          transferNumber: 'TRF-20260821-123456',
          ...args.data,
        })),
        findUnique: jest.fn().mockResolvedValue(createdTransfer),
      },
      productStock: {
        findUnique: jest.fn().mockResolvedValue(stockRow),
        update: jest.fn().mockResolvedValue({ id: 'ps-1' }),
        create: jest.fn().mockResolvedValue({ id: 'ps-new' }),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'sm-1' }) },
    };

    prisma = {
      branch: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where.id === 'outlet-a') return outletA;
          if (where.id === 'outlet-b') return outletB;
          return null;
        }),
      },
      warehouse: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where.id === 'wh-a') return whA;
          if (where.id === 'wh-b') return whB;
          return null;
        }),
        findFirst: jest.fn().mockResolvedValue(centralBad),
        findMany: jest.fn().mockResolvedValue([]),
      },
      product: { findMany: jest.fn().mockResolvedValue([product]) },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      productStock: { findMany: jest.fn().mockResolvedValue([]) },
      stockTransfer: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TransferStockService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<TransferStockService>(TransferStockService);
  });

  describe('create — source validation', () => {
    it('rejects empty items', async () => {
      await expect(
        service.create({ ...baseDto, items: [] }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an unknown source outlet', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an unknown source warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(null);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects an inactive source warehouse', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ ...whA, isActive: false });
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        'Cannot transfer from an inactive warehouse',
      );
    });

    it('rejects a non-GOOD/OUTLET source warehouse (Central Bad Stock as source)', async () => {
      prisma.warehouse.findUnique.mockResolvedValue(centralBad);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        'Source must be an outlet GOOD warehouse',
      );
    });

    it('rejects a source warehouse that does not belong to the source outlet', async () => {
      prisma.warehouse.findUnique.mockResolvedValue({ ...whA, outletId: 'outlet-x' });
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        'Source warehouse must belong to the selected source outlet',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an unknown product', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('create — destination validation (outlet mode)', () => {
    it('rejects missing destination outlet/warehouse', async () => {
      await expect(
        service.create(
          { ...baseDto, toOutletId: undefined, toWarehouseId: undefined },
          'user-1',
        ),
      ).rejects.toThrow(
        'Destination outlet and warehouse are required for outlet transfer',
      );
    });

    it('rejects transferring to the same outlet', async () => {
      await expect(
        service.create({ ...baseDto, toOutletId: 'outlet-a' }, 'user-1'),
      ).rejects.toThrow('Cannot transfer to the same outlet');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an unknown destination outlet', async () => {
      prisma.branch.findUnique
        .mockResolvedValueOnce(outletA)
        .mockResolvedValueOnce(null);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects an unknown destination warehouse', async () => {
      prisma.branch.findUnique
        .mockResolvedValueOnce(outletA)
        .mockResolvedValueOnce(outletB);
      prisma.warehouse.findUnique
        .mockResolvedValueOnce(whA)
        .mockResolvedValueOnce(null);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects an inactive destination warehouse', async () => {
      prisma.branch.findUnique
        .mockResolvedValueOnce(outletA)
        .mockResolvedValueOnce(outletB);
      prisma.warehouse.findUnique
        .mockResolvedValueOnce(whA)
        .mockResolvedValueOnce({ ...whB, isActive: false });
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        'Cannot transfer to an inactive warehouse',
      );
    });

    it('rejects a destination warehouse that is not GOOD/OUTLET', async () => {
      prisma.branch.findUnique
        .mockResolvedValueOnce(outletA)
        .mockResolvedValueOnce(outletB);
      prisma.warehouse.findUnique
        .mockResolvedValueOnce(whA)
        .mockResolvedValueOnce(centralBad);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        'Destination must be an outlet GOOD warehouse',
      );
    });

    it('rejects a destination warehouse that does not belong to the destination outlet', async () => {
      prisma.branch.findUnique
        .mockResolvedValueOnce(outletA)
        .mockResolvedValueOnce(outletB);
      prisma.warehouse.findUnique
        .mockResolvedValueOnce(whA)
        .mockResolvedValueOnce({ ...whB, outletId: 'outlet-x' });
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        'Destination warehouse must belong to the destination outlet',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('create — destination validation (central_bad mode)', () => {
    it('rejects an outlet/warehouse with central_bad mode', async () => {
      await expect(
        service.create(
          {
            outletId: 'outlet-a',
            warehouseId: 'wh-a',
            destinationMode: 'central_bad',
            toOutletId: 'outlet-b',
            toWarehouseId: 'wh-b',
            items: [{ productId: 'prod-1', quantity: 2 }],
          },
          'user-1',
        ),
      ).rejects.toThrow(
        'Central Bad Stock destination does not require an outlet or warehouse',
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects when the system Central Bad Stock warehouse is missing', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);
      await expect(
        service.create(
          {
            outletId: 'outlet-a',
            warehouseId: 'wh-a',
            destinationMode: 'central_bad',
            items: [{ productId: 'prod-1', quantity: 2 }],
          },
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('create — success outlet → outlet', () => {
    it('creates one completed document with OUT + IN atomically', async () => {
      const result = await service.create(baseDto, 'user-1');

      const createdData = tx.stockTransfer.create.mock.calls[0][0].data;
      expect(createdData.status).toBe('completed');
      expect(createdData.requestedBy).toBe('user-1');
      expect(createdData.transferType).toBe('regular');
      expect(createdData.fromWarehouseId).toBe('wh-a');
      expect(createdData.toWarehouseId).toBe('wh-b');
      expect(createdData.fromBranchId).toBe('outlet-a');
      expect(createdData.toBranchId).toBe('outlet-b');

      const createdItems = createdData.items.create;
      expect(createdItems).toHaveLength(1);
      expect(createdItems[0].productName).toBe('iPhone 15');
      expect(createdItems[0].productSku).toBe('IP15-128');
      expect(Number(createdItems[0].quantityRequested)).toBe(2);
      expect(Number(createdItems[0].quantitySent)).toBe(2);
      expect(Number(createdItems[0].quantityReceived)).toBe(2);

      // Exactly two movements: source OUT + destination IN
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);
      const outMovement = tx.stockMovement.create.mock.calls[0][0].data;
      const inMovement = tx.stockMovement.create.mock.calls[1][0].data;

      expect(outMovement.movementType).toBe('OUT');
      expect(outMovement.warehouseId).toBe('wh-a');
      expect(outMovement.branchId).toBe('outlet-a');
      expect(Number(outMovement.quantityChange)).toBe(-2);
      expect(Number(outMovement.quantityBefore)).toBe(10);
      expect(Number(outMovement.quantityAfter)).toBe(8);
      expect(outMovement.referenceType).toBe('TRANSFER');
      expect(outMovement.referenceId).toBe('transfer-1');

      expect(inMovement.movementType).toBe('IN');
      expect(inMovement.warehouseId).toBe('wh-b');
      expect(inMovement.branchId).toBe('outlet-b');
      expect(Number(inMovement.quantityChange)).toBe(2);
      expect(Number(inMovement.quantityBefore)).toBe(10);
      expect(Number(inMovement.quantityAfter)).toBe(12);

      // Source decremented, destination incremented
      expect(tx.productStock.update).toHaveBeenCalledTimes(2);
      const srcUpdate = tx.productStock.update.mock.calls[0][0];
      expect(Number(srcUpdate.data.quantityAvailable)).toBe(8);
      const dstUpdate = tx.productStock.update.mock.calls[1][0];
      expect(Number(dstUpdate.data.quantityAvailable)).toBe(12);

      expect(result.transferNumber).toBe('TRF-20260821-123456');
      expect(Number(result.items[0].quantityRequested)).toBe(2);
    });

    it('merges duplicate product lines into a single line and single movement pair', async () => {
      await service.create(
        {
          ...baseDto,
          items: [
            { productId: 'prod-1', quantity: 3 },
            { productId: 'prod-1', quantity: 4 },
          ],
        },
        'user-1',
      );

      const createdItems = tx.stockTransfer.create.mock.calls[0][0].data.items.create;
      expect(createdItems).toHaveLength(1);
      expect(Number(createdItems[0].quantityRequested)).toBe(7);
      // 1 OUT + 1 IN for the merged line
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);
      expect(Number(tx.stockMovement.create.mock.calls[0][0].data.quantityChange)).toBe(-7);
      expect(Number(tx.stockMovement.create.mock.calls[1][0].data.quantityChange)).toBe(7);
    });
  });

  describe('create — success outlet → Central Bad Stock', () => {
    it('resolves the system BAD warehouse, no destination outlet', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(centralBad);

      await service.create(
        {
          outletId: 'outlet-a',
          warehouseId: 'wh-a',
          destinationMode: 'central_bad',
          notes: 'Rusak',
          items: [{ productId: 'prod-1', quantity: 2 }],
        },
        'user-1',
      );

      const createdData = tx.stockTransfer.create.mock.calls[0][0].data;
      expect(createdData.toWarehouseId).toBe(centralBad.id);
      expect(createdData.toBranchId).toBeNull();

      expect(tx.stockMovement.create).toHaveBeenCalledTimes(2);
      const inMovement = tx.stockMovement.create.mock.calls[1][0].data;
      expect(inMovement.movementType).toBe('IN');
      expect(inMovement.warehouseId).toBe(centralBad.id);
      expect(inMovement.branchId).toBeNull();
    });

    it('creates a destination stock row when none exists (first bad-stock movement)', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(centralBad);
      tx.productStock.findUnique
        .mockResolvedValueOnce(stockRow) // source row exists
        .mockResolvedValueOnce(null); // destination row missing

      await service.create(
        {
          outletId: 'outlet-a',
          warehouseId: 'wh-a',
          destinationMode: 'central_bad',
          items: [{ productId: 'prod-1', quantity: 2 }],
        },
        'user-1',
      );

      const created = tx.productStock.create.mock.calls[0][0].data;
      expect(created.productId).toBe('prod-1');
      expect(created.warehouseId).toBe(centralBad.id);
      expect(created.branchId).toBeNull();
      expect(Number(created.quantityAvailable)).toBe(2);
    });
  });

  describe('create — insufficient stock', () => {
    it('rejects when no stock row exists at the source warehouse', async () => {
      tx.productStock.findUnique.mockResolvedValue(null);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        /Insufficient stock for "iPhone 15" \(available: 0, requested: 2\)/,
      );
      expect(tx.stockTransfer.create).toHaveBeenCalledTimes(1); // rolled back by caller
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
  });

  describe('findAll / findById', () => {
    it('returns serialized rows with pagination meta', async () => {
      prisma.stockTransfer.findMany.mockResolvedValue([createdTransfer]);
      prisma.stockTransfer.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1', fullName: 'Budi' }]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(result.data[0].picName).toBe('Budi');
      expect(Number(result.data[0].items[0].quantityRequested)).toBe(2);
      expect(prisma.stockTransfer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('filters by outlet on either side of the transfer', async () => {
      await service.findAll({ outletId: 'outlet-b' });
      expect(prisma.stockTransfer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ fromBranchId: 'outlet-b' }, { toBranchId: 'outlet-b' }],
          },
        }),
      );
    });

    it('finds a document by id with pic name', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(createdTransfer);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', fullName: 'Budi' });

      const result = await service.findById('transfer-1');
      expect(result.transferNumber).toBe('TRF-20260821-123456');
      expect(result.picName).toBe('Budi');
      expect(Number(result.items[0].quantityReceived)).toBe(2);
    });

    it('throws NotFoundException for an unknown id', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(null);
      await expect(service.findById('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('supporting lists', () => {
    it('findWarehouses filters GOOD OUTLET warehouses by outlet', async () => {
      prisma.warehouse.findMany.mockResolvedValue([whA]);
      const result = await service.findWarehouses('outlet-a');
      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'GOOD', scope: 'OUTLET', isActive: true, outletId: 'outlet-a' },
        }),
      );
      expect(result).toEqual([whA]);
    });

    it('findCentralBad returns the system BAD warehouse', async () => {
      const result = await service.findCentralBad();
      expect(result).toEqual(centralBad);
    });

    it('findCentralBad throws when the system warehouse is missing', async () => {
      prisma.warehouse.findFirst.mockResolvedValue(null);
      await expect(service.findCentralBad()).rejects.toThrow(NotFoundException);
    });

    it('searchProducts includes availableQuantity for the source warehouse', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'iPhone 15', sku: 'IP15-128', unitId: null, unit: null },
      ]);
      prisma.productStock.findMany.mockResolvedValue([
        { productId: 'prod-1', quantityAvailable: new Decimal(7) },
      ]);

      const result = await service.searchProducts('iphone', 15, 'wh-a');
      expect(result[0].availableQuantity).toBe(7);
    });

    it('searchProducts reports 0 availability without a warehouse', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'iPhone 15', sku: 'IP15-128', unitId: null, unit: null },
      ]);
      const result = await service.searchProducts('iphone', 15, undefined);
      expect(result[0].availableQuantity).toBe(0);
      expect(prisma.productStock.findMany).not.toHaveBeenCalled();
    });
  });
});
