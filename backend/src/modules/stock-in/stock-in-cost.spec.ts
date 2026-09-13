import { Test, TestingModule } from '@nestjs/testing';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockInService } from './stock-in.service';
import { CreateStockInDto } from './dto/create-stock-in.dto';

/**
 * IGDERP-182 thin slice: PO number passthrough + per-unit cost on IN movements.
 * No FIFO logic here — this only lays the data foundation.
 */
describe('StockInService cost layer (IGDERP-182 thin)', () => {
  let service: StockInService;
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
    name: 'Kabel Data',
    sku: 'KBL-001',
    sellingPrice: new Decimal(15000),
    minSellingPrice: new Decimal(12150),
    unitId: 'unit-1',
    unit: { id: 'unit-1', name: 'pcs' },
  };

  beforeEach(async () => {
    tx = {
      stockIn: {
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'stockin-1',
          documentNumber: 'SIN-20260913-000001',
          ...args.data,
        })),
        update: jest.fn().mockImplementation(async (args: any) => ({
          id: 'stockin-1',
          totalValue: args.data.totalValue,
          items: [],
        })),
      },
      productStock: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'ps-1' }),
        create: jest.fn().mockResolvedValue({ id: 'ps-1' }),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'sm-1' }) },
    };
    const prisma = {
      branch: { findUnique: jest.fn().mockResolvedValue(outlet) },
      warehouse: { findUnique: jest.fn().mockResolvedValue(goodWarehouse), findMany: jest.fn().mockResolvedValue([]) },
      customer: { findUnique: jest.fn().mockResolvedValue(null) },
      product: { findMany: jest.fn().mockResolvedValue([product]) },
      unit: { findMany: jest.fn().mockResolvedValue([{ id: 'unit-1', name: 'pcs' }]) },
      stockIn: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      customerTier: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [StockInService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<StockInService>(StockInService);
  });

  it('persists poNumber on the document', async () => {
    const dto: CreateStockInDto = {
      outletId: 'outlet-1',
      warehouseId: 'wh-1',
      poNumber: 'PO-2026-0091',
      reason: 'Restock kabel',
      items: [{ productId: 'prod-1', quantity: 10 }],
    };
    await service.create(dto, 'user-1');
    expect(tx.stockIn.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ poNumber: 'PO-2026-0091' }) }),
    );
  });

  it('stores null poNumber when omitted', async () => {
    const dto: CreateStockInDto = {
      outletId: 'outlet-1',
      warehouseId: 'wh-1',
      reason: 'Restock kabel',
      items: [{ productId: 'prod-1', quantity: 10 }],
    };
    await service.create(dto, 'user-1');
    expect(tx.stockIn.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ poNumber: null }) }),
    );
  });

  it('writes the per-unit stockValue as movement unitCost', async () => {
    const dto: CreateStockInDto = {
      outletId: 'outlet-1',
      warehouseId: 'wh-1',
      poNumber: 'PO-2026-0091',
      reason: 'Restock kabel',
      items: [{ productId: 'prod-1', quantity: 10, stockValue: 12050 }],
    };
    await service.create(dto, 'user-1');
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: 'IN',
          unitCost: new Decimal(12050),
        }),
      }),
    );
  });
});
