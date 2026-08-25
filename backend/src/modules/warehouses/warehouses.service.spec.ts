import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { WarehousesService } from './warehouses.service';

type CountModel = {
  count: jest.Mock;
};

const warehouseRow = (overrides: any = {}) => ({
  id: 'wh-1',
  name: 'Gudang Pusat',
  code: 'WH-001',
  type: 'GOOD',
  scope: 'OUTLET',
  outletId: 'br-1',
  isActive: true,
  ...overrides,
});

describe('WarehousesService warehouse identity invariants', () => {
  let service: WarehousesService;
  let prisma: {
    warehouse: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    branch: { findUnique: jest.Mock };
    productStock: CountModel;
    stockMovement: CountModel;
    stockTransfer: CountModel;
    stockOpname: CountModel;
    stockIn: CountModel;
    stockOut: CountModel;
    salesTransaction: CountModel;
    serviceOrder: CountModel;
  };

  beforeEach(async () => {
    prisma = {
      warehouse: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      branch: { findUnique: jest.fn() },
      productStock: { count: jest.fn().mockResolvedValue(0) },
      stockMovement: { count: jest.fn().mockResolvedValue(0) },
      stockTransfer: { count: jest.fn().mockResolvedValue(0) },
      stockOpname: { count: jest.fn().mockResolvedValue(0) },
      stockIn: { count: jest.fn().mockResolvedValue(0) },
      stockOut: { count: jest.fn().mockResolvedValue(0) },
      salesTransaction: { count: jest.fn().mockResolvedValue(0) },
      serviceOrder: { count: jest.fn().mockResolvedValue(0) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
  });

  it('rejects creating a second active system BAD warehouse', async () => {
    prisma.warehouse.findFirst.mockResolvedValue({
      id: 'central-bad-existing',
      type: 'BAD',
      scope: 'SYSTEM',
      outletId: null,
      isActive: true,
    });

    await expect(
      service.create({
        name: 'Another Bad Stock',
        type: 'BAD',
        scope: 'SYSTEM',
        outletId: null,
      } as any),
    ).rejects.toThrow(ConflictException);

    expect(prisma.warehouse.create).not.toHaveBeenCalled();
  });

  it('rejects deactivating the active Central Bad Stock warehouse', async () => {
    prisma.warehouse.findUnique.mockResolvedValue({
      id: 'central-bad',
      type: 'BAD',
      scope: 'SYSTEM',
      outletId: null,
      isActive: true,
      name: 'Central Bad Stock',
      code: 'BAD-SYSTEM',
    });

    await expect(
      service.update('central-bad', { isActive: false } as any),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.warehouse.update).not.toHaveBeenCalled();
  });

  it('excludes system warehouses from normal active selectors', async () => {
    prisma.warehouse.findMany.mockResolvedValue([]);

    await service.findActive();

    expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, scope: 'OUTLET' },
      }),
    );
  });
});

describe('WarehousesService D8 delete/deactivate guard', () => {
  let service: WarehousesService;
  let prisma: any;

  const seedCleanCounts = () => {
    prisma.productStock.count.mockResolvedValue(0);
    prisma.stockMovement.count.mockResolvedValue(0);
    prisma.stockTransfer.count.mockResolvedValue(0);
    prisma.stockOpname.count.mockResolvedValue(0);
    prisma.stockIn.count.mockResolvedValue(0);
    prisma.stockOut.count.mockResolvedValue(0);
    prisma.salesTransaction.count.mockResolvedValue(0);
    prisma.serviceOrder.count.mockResolvedValue(0);
  };

  beforeEach(async () => {
    prisma = {
      warehouse: {
        findUnique: jest.fn().mockResolvedValue(warehouseRow()),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue(warehouseRow()),
        count: jest.fn(),
      },
      branch: { findUnique: jest.fn().mockResolvedValue({ id: 'br-1' }) },
      productStock: { count: jest.fn() },
      stockMovement: { count: jest.fn() },
      stockTransfer: { count: jest.fn() },
      stockOpname: { count: jest.fn() },
      stockIn: { count: jest.fn() },
      stockOut: { count: jest.fn() },
      salesTransaction: { count: jest.fn() },
      serviceOrder: { count: jest.fn() },
    };
    seedCleanCounts();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
  });

  it('blocks delete when the warehouse has product stock, naming the reference', async () => {
    prisma.productStock.count.mockResolvedValue(55);

    await expect(service.delete('wh-1')).rejects.toThrow(BadRequestException);
    await expect(service.delete('wh-1')).rejects.toThrow('55 stok produk');
    expect(prisma.warehouse.update).not.toHaveBeenCalled();
  });

  it('blocks delete when the warehouse has stock movements, naming the reference', async () => {
    prisma.stockMovement.count.mockResolvedValue(3);

    await expect(service.delete('wh-1')).rejects.toThrow('3 pergerakan stok');
    expect(prisma.warehouse.update).not.toHaveBeenCalled();
  });

  it('blocks delete when referenced by stock transfers, opname, stock in/out, sales or service orders', async () => {
    prisma.stockTransfer.count.mockResolvedValueOnce(1); // from
    prisma.stockTransfer.count.mockResolvedValueOnce(0); // to
    prisma.stockOpname.count.mockResolvedValue(1);

    await expect(service.delete('wh-1')).rejects.toThrow('stock opname');
    expect(prisma.warehouse.update).not.toHaveBeenCalled();

    seedCleanCounts();
    prisma.salesTransaction.count.mockResolvedValue(2);
    await expect(service.delete('wh-1')).rejects.toThrow('2 transaksi penjualan');
  });

  it('soft-deletes an unencumbered warehouse (all counts zero)', async () => {
    await service.delete('wh-1');

    expect(prisma.warehouse.update).toHaveBeenCalledWith({
      where: { id: 'wh-1' },
      data: { isActive: false },
    });
  });

  it('blocks deactivation via update when the warehouse has stock', async () => {
    prisma.productStock.count.mockResolvedValue(7);

    await expect(
      service.update('wh-1', { isActive: false } as any),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.update('wh-1', { isActive: false } as any),
    ).rejects.toThrow('7 stok produk');
    expect(prisma.warehouse.update).not.toHaveBeenCalled();
  });

  it('allows deactivation via update when the warehouse is unencumbered', async () => {
    await service.update('wh-1', { isActive: false } as any);

    expect(prisma.warehouse.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wh-1' },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it('allows non-deactivation edits even when the warehouse has stock', async () => {
    prisma.productStock.count.mockResolvedValue(55);

    await service.update('wh-1', { city: 'Jember' } as any);

    expect(prisma.warehouse.update).toHaveBeenCalled();
  });

  it('does not re-check references when deactivating an already-inactive warehouse', async () => {
    prisma.warehouse.findUnique.mockResolvedValue(warehouseRow({ isActive: false }));

    await service.update('wh-1', { isActive: false } as any);

    expect(prisma.productStock.count).not.toHaveBeenCalled();
    expect(prisma.warehouse.update).toHaveBeenCalled();
  });
});
