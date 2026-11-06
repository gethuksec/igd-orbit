import { PosService } from './pos.service';

const UUID = (s: string) => s;

describe('PosService.createTransaction idempotency (IGDERP-239)', () => {
  let service: PosService;
  let prisma: any;
  let tx: any;

  const dto = (over: Record<string, any> = {}) => ({
    branchId: UUID('11111111-1111-4111-8111-111111111111'),
    warehouseId: UUID('22222222-2222-4222-8222-222222222222'),
    items: [
      {
        productId: UUID('33333333-3333-4333-8333-333333333333'),
        quantity: 2,
        unitPrice: 50000,
      },
    ],
    taxPercentage: 0,
    payment: { method: 'cash', amount: 100000 },
    clientMutationId: UUID('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    ...over,
  });

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

  beforeEach(() => {
    tx = {
      salesTransaction: { create: jest.fn(), findUnique: jest.fn() },
      productStock: { update: jest.fn() },
      stockMovement: { create: jest.fn() },
      payment: { create: jest.fn() },
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
  });

  it('returns the original transaction on replay without touching stock', async () => {
    const original = { id: 'tx-orig', items: [], payments: [] };
    prisma.salesTransaction.findUnique.mockResolvedValue(original);

    const out = await service.createTransaction(dto(), 'user-1');

    expect(out).toBe(original);
    expect(prisma.warehouse.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('stores clientMutationId on fresh create', async () => {
    prisma.salesTransaction.findUnique.mockResolvedValue(null);
    prisma.warehouse.findUnique.mockResolvedValue(warehouse);
    prisma.product.findMany.mockResolvedValue([product]);
    tx.salesTransaction.create.mockResolvedValue({ id: 'tx-new', transactionNumber: 'TRX-X' });
    tx.productStock.update.mockResolvedValue({});
    tx.stockMovement.create.mockResolvedValue({});
    tx.payment.create.mockResolvedValue({});

    await service.createTransaction(dto(), 'user-1');

    expect(tx.salesTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientMutationId: UUID('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
        }),
      }),
    );
    expect(tx.productStock.update).toHaveBeenCalledTimes(1);
  });

  it('P2002 race returns the winner without double-deducting stock', async () => {
    prisma.salesTransaction.findUnique.mockResolvedValue(null);
    prisma.warehouse.findUnique.mockResolvedValue(warehouse);
    prisma.product.findMany.mockResolvedValue([product]);
    const winner = { id: 'tx-winner', items: [], payments: [] };
    tx.salesTransaction.create.mockRejectedValue({ code: 'P2002' });
    tx.salesTransaction.findUnique.mockResolvedValue(winner);

    const out = await service.createTransaction(dto(), 'user-1');

    expect(out).toBe(winner);
    expect(tx.productStock.update).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('no key means legacy behavior (no dedupe lookup)', async () => {
    prisma.warehouse.findUnique.mockResolvedValue(warehouse);
    prisma.product.findMany.mockResolvedValue([product]);
    tx.salesTransaction.create.mockResolvedValue({ id: 'tx-legacy' });
    tx.productStock.update.mockResolvedValue({});
    tx.stockMovement.create.mockResolvedValue({});
    tx.payment.create.mockResolvedValue({});

    await service.createTransaction(dto({ clientMutationId: undefined }), 'user-1');

    expect(prisma.salesTransaction.findUnique).not.toHaveBeenCalled();
  });
});
