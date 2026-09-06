import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { ApprovalSettingsService } from '../approval-settings/approval-settings.service';
import { GoodsReceiptsService } from './services/goods-receipts.service';
import { ApproveGoodsReceiptDto } from './dto/approve-goods-receipt.dto';

describe('GoodsReceiptsService.approve — central-good landing (IGDERP-159)', () => {
  let service: GoodsReceiptsService;
  let prisma: {
    goodsReceipt: { findUnique: jest.Mock; update: jest.Mock };
    warehouse: { findFirst: jest.Mock };
    purchaseAttachment: { count: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    productStock: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    stockMovement: { create: jest.Mock };
    purchaseOrderItem: { findUnique: jest.Mock };
    purchaseOrder: { findUnique: jest.Mock };
    goodsReceipt: { update: jest.Mock };
    goodsReceiptEvent: { create: jest.Mock };
  };
  const approval = {
    assertApprover: jest.fn().mockResolvedValue({ kind: 'default' }),
    getRow: jest.fn().mockResolvedValue(null),
  };

  const centralGood = {
    id: '00000000-0000-4000-8000-000000000002',
    code: 'CENTRAL-GOOD',
    name: 'Central Good Stock',
    type: 'GOOD',
    scope: 'SYSTEM',
    outletId: null,
    isActive: true,
  };

  const gr = {
    id: 'gr-1',
    grNumber: 'GR-20260906-000001',
    status: 'received',
    branchId: 'branch-1',
    purchaseOrderId: null,
    purchaseOrder: null,
    internalNotes: null,
    items: [
      {
        id: 'gri-1',
        goodsReceiptId: 'gr-1',
        productId: 'prod-1',
        purchaseOrderItemId: null,
        quantityReceived: new Decimal(4),
        quantityAccepted: new Decimal(4),
        quantityRejected: new Decimal(0),
        batchNumber: null,
        serialNumber: null,
        product: { id: 'prod-1', name: 'iPhone 15' },
      },
    ],
  };

  const stockRow = {
    id: 'ps-1',
    productId: 'prod-1',
    warehouseId: centralGood.id,
    quantityAvailable: new Decimal(6),
  };

  const dto: ApproveGoodsReceiptDto = {
    inspection_status: 'passed',
    inspection_notes: null,
    notes: null,
  } as any;

  beforeEach(async () => {
    tx = {
      productStock: {
        findUnique: jest.fn().mockResolvedValue(stockRow),
        create: jest.fn().mockResolvedValue({
          id: 'ps-new',
          quantityAvailable: new Decimal(0),
        }),
        update: jest.fn().mockResolvedValue({ id: 'ps-1' }),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'sm-1' }) },
      purchaseOrderItem: { findUnique: jest.fn() },
      purchaseOrder: { findUnique: jest.fn() },
      goodsReceiptEvent: { create: jest.fn().mockResolvedValue({ id: 'ev-1' }) },
      goodsReceipt: {
        update: jest.fn().mockResolvedValue({
          id: 'gr-1',
          variancePercent: null,
          items: [
            {
              ...gr.items[0],
              quantityReceived: new Decimal(4),
              quantityAccepted: new Decimal(4),
              quantityRejected: new Decimal(0),
              unitPrice: new Decimal(1000),
              notes: null,
            },
          ],
        }),
      },
    };

    prisma = {
      goodsReceipt: { findUnique: jest.fn().mockResolvedValue(gr), update: jest.fn() },
      warehouse: { findFirst: jest.fn().mockResolvedValue(centralGood) },
      purchaseAttachment: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };
    approval.assertApprover.mockClear().mockResolvedValue({ kind: 'default' });
    approval.getRow.mockClear().mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoodsReceiptsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ApprovalSettingsService, useValue: approval },
      ],
    }).compile();

    service = module.get<GoodsReceiptsService>(GoodsReceiptsService);
  });

  it('lands accepted quantity in central-good with branchId null', async () => {
    await service.approve('gr-1', dto, 'user-1', ['HS']);

    // Warehouse resolution targets the system GOOD warehouse, not an outlet warehouse
    expect(prisma.warehouse.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: 'GOOD', scope: 'SYSTEM', isActive: true },
      }),
    );
    expect(prisma.warehouse.findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ outletId: 'branch-1' }) }),
    );

    // Stock row exists → update at central-good
    expect(tx.productStock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId_warehouseId: { productId: 'prod-1', warehouseId: centralGood.id },
        },
        data: { quantityAvailable: expect.any(Decimal) },
      }),
    );
    expect(tx.productStock.update.mock.calls[0][0].data.quantityAvailable.toNumber()).toBe(10);

    // Movement row: PURCHASE IN at central-good, no branch
    const movement = tx.stockMovement.create.mock.calls[0][0].data;
    expect(movement.warehouseId).toBe(centralGood.id);
    expect(movement.branchId).toBeNull();
    expect(movement.movementType).toBe('IN');
    expect(movement.referenceType).toBe('PURCHASE');
    expect(movement.referenceId).toBe('gr-1');
    expect(movement.quantityChange.toNumber()).toBe(4);

    // GR marked approved
    expect(tx.goodsReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'approved' }) }),
    );
  });

  it('creates the central-good stock row when none exists for the product', async () => {
    tx.productStock.findUnique.mockResolvedValue(null);

    await service.approve('gr-1', dto, 'user-1', ['SPV']);

    const created = tx.productStock.create.mock.calls[0][0].data;
    expect(created.warehouseId).toBe(centralGood.id);
    expect(created.branchId).toBeNull();
    expect(created.quantityAvailable.toNumber()).toBe(0);

    const update = tx.productStock.update.mock.calls[0][0];
    expect(update.data.quantityAvailable.toNumber()).toBe(4);
  });

  it('rejects approval when central-good is not seeded', async () => {
    prisma.warehouse.findFirst.mockResolvedValue(null);

    await expect(
      service.approve('gr-1', dto, 'user-1', ['CSO']),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a user without approval authority', async () => {
    approval.assertApprover.mockRejectedValueOnce(
      new ForbiddenException('You do not have authority to approve goods receipts'),
    );
    await expect(
      service.approve('gr-1', dto, 'user-1', ['ASA']),
    ).rejects.toThrow(ForbiddenException);
  });
});
