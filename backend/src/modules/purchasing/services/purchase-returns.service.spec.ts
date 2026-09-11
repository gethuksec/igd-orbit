import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../shared/services/prisma.service';
import { PurchaseReturnsService } from './purchase-returns.service';

describe('PurchaseReturnsService (S4 — IGDERP-84 manual + IGDERP-83 receiving)', () => {
  let service: PurchaseReturnsService;
  let prisma: any;
  let tx: any;

  const poReceived = {
    id: 'po-1',
    poNumber: 'PO-20260911-000001',
    status: 'received',
    supplierId: 'sup-1',
    invoiceNumber: 'INV-001',
    items: [
      {
        id: 'poi-1',
        productId: 'prod-1',
        quantityOrdered: new Decimal(10),
        quantityReceived: new Decimal(10),
        unitPrice: new Decimal(50000),
        product: { name: 'Charger' },
      },
      {
        id: 'poi-2',
        productId: 'prod-2',
        quantityOrdered: new Decimal(5),
        quantityReceived: new Decimal(5),
        unitPrice: new Decimal(100000),
        product: { name: 'Case' },
      },
    ],
  };

  const fullReturn = {
    id: 'ret-1',
    returnNumber: 'RTP-20260911-000001',
    totalQty: new Decimal(3),
    totalValue: new Decimal(200000),
    items: [
      {
        id: 'ri-1',
        productId: 'prod-1',
        quantity: new Decimal(2),
        unitPrice: new Decimal(50000),
        subtotal: new Decimal(100000),
      },
      {
        id: 'ri-2',
        productId: 'prod-2',
        quantity: new Decimal(1),
        unitPrice: new Decimal(100000),
        subtotal: new Decimal(100000),
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      purchaseOrder: { findUnique: jest.fn() },
      purchaseReturn: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      purchaseReturnItem: { findMany: jest.fn() },
      warehouse: { findFirst: jest.fn() },
    };
    tx = {
      purchaseReturn: {
        create: jest.fn().mockResolvedValue({ id: 'ret-1' }),
        findUnique: jest.fn().mockResolvedValue(fullReturn),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      purchaseReturnItem: { createMany: jest.fn() },
      productStock: {
        findUnique: jest.fn().mockResolvedValue({ quantityAvailable: new Decimal(10) }),
        create: jest.fn(),
        update: jest.fn(),
      },
      stockMovement: { create: jest.fn() },
    };
    prisma.$transaction = jest.fn(async (cb: any) => cb(tx));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseReturnsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(PurchaseReturnsService);
  });

  const okSetup = () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue(poReceived);
    prisma.purchaseReturn.findFirst.mockResolvedValue(null);
    prisma.purchaseReturnItem.findMany.mockResolvedValue([]);
    prisma.warehouse.findFirst
      .mockResolvedValueOnce({ id: 'wh-good' })
      .mockResolvedValueOnce({ id: 'wh-bad' });
  };

  it('manual return: reduces central-good, parks in central-bad, 2 movements per line', async () => {
    okSetup();
    const result = await service.create(
      {
        purchase_order_id: 'po-1',
        reason: 'Barang rusak',
        items: [
          { product_id: 'prod-1', quantity: 2 },
          { product_id: 'prod-2', quantity: 1, reason: 'Pecah' },
        ],
      } as any,
      'user-1',
    );

    const createCall = tx.purchaseReturn.create.mock.calls[0][0];
    expect(createCall.data.source).toBe('manual');
    expect(createCall.data.totalQty.toNumber()).toBe(3);
    expect(createCall.data.totalValue.toNumber()).toBe(200000);
    expect(createCall.data.items.create).toHaveLength(2);

    // stock movements: OUT central-good + IN central-bad per line
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(4);
    const outMove = tx.stockMovement.create.mock.calls[0][0].data;
    expect(outMove.movementType).toBe('OUT');
    expect(outMove.referenceType).toBe('PURCHASE_RETURN');
    expect(outMove.quantityChange.toNumber()).toBe(-2);
    const inMove = tx.stockMovement.create.mock.calls[1][0].data;
    expect(inMove.movementType).toBe('IN');
    expect(inMove.quantityChange.toNumber()).toBe(2);

    // good stock 10 → 8 for line 1
    const goodUpdate = tx.productStock.update.mock.calls[0][0];
    expect(goodUpdate.data.quantityAvailable.toNumber()).toBe(8);

    expect(result.totalValue).toBe(200000);
  });

  it('blocks quantities over received − already returned', async () => {
    okSetup();
    await expect(
      service.create(
        {
          purchase_order_id: 'po-1',
          reason: 'x',
          items: [{ product_id: 'prod-1', quantity: 11 }],
        } as any,
        'user-1',
      ),
    ).rejects.toThrow('Jumlah retur melebihi jumlah diterima (maks 10)');
  });

  it('blocks a second return for the same invoice (1 invoice = 1 return)', async () => {
    okSetup();
    prisma.purchaseReturn.findFirst.mockResolvedValue({
      returnNumber: 'RTP-20260910-000009',
    });
    await expect(
      service.create(
        {
          purchase_order_id: 'po-1',
          reason: 'x',
          items: [{ product_id: 'prod-1', quantity: 1 }],
        } as any,
        'user-1',
      ),
    ).rejects.toThrow('Retur untuk invoice ini sudah dibuat (RTP-20260910-000009)');
  });

  it('blocks when central-good stock is insufficient', async () => {
    okSetup();
    tx.productStock.findUnique.mockResolvedValue({
      quantityAvailable: new Decimal(1),
    });
    await expect(
      service.create(
        {
          purchase_order_id: 'po-1',
          reason: 'x',
          items: [{ product_id: 'prod-1', quantity: 2 }],
        } as any,
        'user-1',
      ),
    ).rejects.toThrow('Stok central-good tidak cukup untuk retur');
  });

  it('only allows returns for received POs', async () => {
    okSetup();
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      ...poReceived,
      status: 'pending',
    });
    await expect(
      service.create(
        {
          purchase_order_id: 'po-1',
          reason: 'x',
          items: [{ product_id: 'prod-1', quantity: 1 }],
        } as any,
        'user-1',
      ),
    ).rejects.toThrow('Retur pembelian hanya untuk PO yang sudah diterima');
  });

  it('requires a reason', async () => {
    okSetup();
    await expect(
      service.create(
        {
          purchase_order_id: 'po-1',
          reason: '   ',
          items: [{ product_id: 'prod-1', quantity: 1 }],
        } as any,
        'user-1',
      ),
    ).rejects.toThrow('Alasan retur wajib diisi');
  });

  it('IGDERP-83: receiving flag creates the return document without touching stock', async () => {
    const gr = {
      id: 'gr-1',
      grNumber: 'GR-20260911-000001',
      purchaseOrderId: 'po-1',
      purchaseOrder: {
        supplierId: 'sup-1',
        invoiceNumber: 'INV-001',
        items: poReceived.items,
      },
    };
    const flagged = [
      {
        productId: 'prod-1',
        purchaseOrderItemId: 'poi-1',
        quantityRejected: new Decimal(1),
        unitPrice: new Decimal(50000),
        inspectionNotes: 'Layar retak',
      },
    ];
    tx.purchaseReturn.findFirst.mockResolvedValue(null);

    await service.createReceivingReturn(tx, gr, flagged, 'user-1');

    const createCall = tx.purchaseReturn.create.mock.calls[0][0];
    expect(createCall.data.source).toBe('receiving');
    expect(createCall.data.reason).toContain('GR-20260911-000001');
    expect(createCall.data.totalQty.toNumber()).toBe(1);
    expect(createCall.data.items.create[0].reason).toBe('Layar retak');
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.productStock.update).not.toHaveBeenCalled();
  });

  it("IGDERP-83: flagged lines merge into the invoice's existing return", async () => {
    const gr = {
      id: 'gr-1',
      grNumber: 'GR-20260911-000002',
      purchaseOrderId: 'po-1',
      purchaseOrder: {
        supplierId: 'sup-1',
        invoiceNumber: 'INV-001',
        items: poReceived.items,
      },
    };
    const flagged = [
      {
        productId: 'prod-2',
        purchaseOrderItemId: 'poi-2',
        quantityRejected: new Decimal(2),
        unitPrice: new Decimal(100000),
        inspectionNotes: null,
      },
    ];
    tx.purchaseReturn.findFirst.mockResolvedValue({
      id: 'ret-1',
      totalQty: new Decimal(3),
      totalValue: new Decimal(200000),
    });

    await service.createReceivingReturn(tx, gr, flagged, 'user-1');

    expect(tx.purchaseReturn.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ret-1' } }),
    );
    const updateData = tx.purchaseReturn.update.mock.calls[0][0].data;
    expect(updateData.totalQty.toNumber()).toBe(5);
    expect(updateData.totalValue.toNumber()).toBe(400000);
    expect(tx.purchaseReturnItem.createMany).toHaveBeenCalled();
    expect(tx.purchaseReturn.create).not.toHaveBeenCalled();
  });

  it('findById throws NotFound on a missing return', async () => {
    prisma.purchaseReturn.findUnique.mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
  });
});
