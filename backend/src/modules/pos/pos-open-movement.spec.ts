import { PosService } from './pos.service';

const UUID = (s: string) => s;

/**
 * IGDERP-235 (OP3) acceptance: a sale during an OPEN session appears as a
 * SOLD movement (shifting Expected); with no OPEN session nothing is logged.
 */
describe('PosService.createTransaction OPEN movement capture (IGDERP-235)', () => {
  let service: PosService;
  let prisma: any;
  let tx: any;

  const warehouse = {
    id: UUID('22222222-2222-4222-8222-222222222222'),
    isActive: true,
    type: 'GOOD',
    outletId: UUID('11111111-1111-4111-8111-111111111111'),
  };

  const product = {
    id: UUID('33333333-3333-4333-8333-333333333333'),
    name: 'Produk A',
    sku: 'SKU-A',
    productStocks: [
      {
        id: 'stock-1',
        quantityAvailable: { toNumber: () => 10 },
        warehouseId: warehouse.id,
        branchId: warehouse.outletId,
      },
    ],
  };

  const dto = () => ({
    branchId: warehouse.outletId,
    warehouseId: warehouse.id,
    items: [{ productId: product.id, quantity: 2, unitPrice: 50000 }],
    taxPercentage: 0,
    payment: { method: 'cash', amount: 100000 },
    clientMutationId: undefined,
  });

  beforeEach(() => {
    tx = {
      salesTransaction: { create: jest.fn(), findUnique: jest.fn() },
      productStock: { update: jest.fn() },
      stockMovement: { create: jest.fn() },
      payment: { create: jest.fn() },
      stockOpname: { findMany: jest.fn().mockResolvedValue([]) },
      opnameMovement: { createMany: jest.fn() },
    };
    prisma = {
      salesTransaction: { findUnique: jest.fn() },
      warehouse: { findUnique: jest.fn(), findFirst: jest.fn() },
      product: { findMany: jest.fn() },
      stockOpname: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    service = new PosService(prisma);
    jest.clearAllMocks();

    prisma.warehouse.findUnique.mockResolvedValue(warehouse);
    prisma.product.findMany.mockResolvedValue([product]);
    tx.salesTransaction.create.mockResolvedValue({ id: 'tx-new', transactionNumber: 'TRX-X' });
    tx.productStock.update.mockResolvedValue({});
    tx.stockMovement.create.mockResolvedValue({});
    tx.payment.create.mockResolvedValue({});
  });

  it('logs a SOLD movement when an OPEN session runs on the outlet', async () => {
    tx.stockOpname.findMany.mockResolvedValue([{ id: 'op-1', warehouseId: warehouse.id }]);

    await service.createTransaction(dto() as any, 'user-1');

    expect(tx.opnameMovement.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          opnameId: 'op-1',
          productId: product.id,
          quantityChange: -2,
          movementType: 'SOLD',
          referenceType: 'SALE',
          referenceId: 'tx-new',
        }),
      ],
    });
  });

  it('logs nothing when no OPEN session runs', async () => {
    await service.createTransaction(dto() as any, 'user-1');

    expect(tx.stockOpname.findMany).toHaveBeenCalled();
    expect(tx.opnameMovement.createMany).not.toHaveBeenCalled();
  });
});
