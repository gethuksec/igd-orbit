import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockService } from './stock.service';

describe('Warehouse-scoped stock persistence (integration boundary)', () => {
  let service: StockService;
  let prisma: {
    product: { findUnique: jest.Mock };
    warehouse: { findUnique: jest.Mock; findFirst: jest.Mock };
    productStock: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let transactionClient: {
    productStock: { update: jest.Mock };
    stockMovement: { create: jest.Mock };
  };

  beforeEach(async () => {
    transactionClient = {
      productStock: { update: jest.fn() },
      stockMovement: { create: jest.fn() },
    };

    prisma = {
      product: { findUnique: jest.fn() },
      warehouse: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      productStock: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(transactionClient)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
  });

  it('persists a system BAD adjustment with warehouse identity and no branch', async () => {
    const badWarehouse = {
      id: 'warehouse-bad',
      outletId: null,
      type: 'BAD',
      scope: 'SYSTEM',
      isActive: true,
    };
    const createdStock = {
      id: 'stock-bad',
      productId: 'product-1',
      warehouseId: badWarehouse.id,
      branchId: null,
      quantityAvailable: new Decimal(0),
      quantityReserved: new Decimal(0),
      quantityDamaged: new Decimal(0),
    };

    prisma.product.findUnique.mockResolvedValue({ id: 'product-1' });
    prisma.warehouse.findUnique.mockResolvedValue(badWarehouse);
    prisma.productStock.findUnique.mockResolvedValue(null);
    prisma.productStock.create.mockResolvedValue(createdStock);
    transactionClient.productStock.update.mockResolvedValue({
      ...createdStock,
      quantityAvailable: new Decimal(3),
    });

    await service.adjustStock(
      {
        productId: 'product-1',
        warehouseId: badWarehouse.id,
        type: 'IN',
        quantityChange: 3,
        reason: 'Move damaged stock',
      },
      'user-1',
    );

    expect(prisma.productStock.findUnique).toHaveBeenCalledWith({
      where: {
        productId_warehouseId: {
          productId: 'product-1',
          warehouseId: badWarehouse.id,
        },
      },
    });
    expect(prisma.productStock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'product-1',
        warehouseId: badWarehouse.id,
        branchId: null,
      }),
    });
    expect(transactionClient.productStock.update).toHaveBeenCalledWith({
      where: {
        productId_warehouseId: {
          productId: 'product-1',
          warehouseId: badWarehouse.id,
        },
      },
      data: expect.objectContaining({
        quantityAvailable: new Decimal(3),
      }),
    });

    const movement = transactionClient.stockMovement.create.mock.calls[0][0].data;
    expect(movement).toEqual(
      expect.objectContaining({
        productId: 'product-1',
        warehouseId: badWarehouse.id,
        branchId: null,
        quantityChange: new Decimal(3),
      }),
    );
  });

  it('resolves a legacy branch caller to the outlet GOOD warehouse', async () => {
    const goodWarehouse = {
      id: 'warehouse-good',
      outletId: 'branch-1',
      type: 'GOOD',
      scope: 'OUTLET',
      isActive: true,
    };
    const stock = {
      id: 'stock-good',
      productId: 'product-1',
      warehouseId: goodWarehouse.id,
      branchId: 'branch-1',
      quantityAvailable: new Decimal(10),
      quantityReserved: new Decimal(0),
      quantityDamaged: new Decimal(0),
    };

    prisma.product.findUnique.mockResolvedValue({ id: 'product-1' });
    prisma.warehouse.findFirst.mockResolvedValue(goodWarehouse);
    prisma.productStock.findUnique.mockResolvedValue(stock);
    transactionClient.productStock.update.mockResolvedValue({
      ...stock,
      quantityAvailable: new Decimal(8),
    });

    await service.adjustStock(
      {
        productId: 'product-1',
        branchId: 'branch-1',
        type: 'OUT',
        quantityChange: 2,
        reason: 'Legacy branch adjustment',
      },
      'user-1',
    );

    expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
      where: {
        outletId: 'branch-1',
        type: 'GOOD',
        scope: 'OUTLET',
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    expect(transactionClient.productStock.update).toHaveBeenCalledWith({
      where: {
        productId_warehouseId: {
          productId: 'product-1',
          warehouseId: goodWarehouse.id,
        },
      },
      data: expect.objectContaining({
        quantityAvailable: new Decimal(8),
      }),
    });

    const movement = transactionClient.stockMovement.create.mock.calls[0][0].data;
    expect(movement).toEqual(
      expect.objectContaining({
        warehouseId: goodWarehouse.id,
        branchId: 'branch-1',
        quantityChange: new Decimal(-2),
      }),
    );
  });

  it('uses warehouseId instead of branchId when both read filters are supplied', async () => {
    prisma.productStock.findMany.mockResolvedValue([]);
    prisma.productStock.count.mockResolvedValue(0);

    await service.getStockSummary({
      warehouseId: 'warehouse-good',
      branchId: 'branch-1',
    });

    expect(prisma.productStock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          warehouseId: 'warehouse-good',
        }),
      }),
    );
    expect(prisma.productStock.findMany.mock.calls[0][0].where).not.toHaveProperty(
      'branchId',
    );
    expect(prisma.productStock.count).toHaveBeenCalledWith({
      where: expect.objectContaining({ warehouseId: 'warehouse-good' }),
    });
  });
});
