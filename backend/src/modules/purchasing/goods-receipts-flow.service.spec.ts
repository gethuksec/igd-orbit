import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { ApprovalSettingsService } from '../approval-settings/approval-settings.service';
import { GoodsReceiptsService } from './services/goods-receipts.service';
import { RevisitGoodsReceiptDto, UpdateReceivingDto } from './dto/receiving.dto';

describe('GoodsReceiptsService IGDERP-80 flows (revisit / receiving / rejected->bad / gates)', () => {
  let service: GoodsReceiptsService;
  let prisma: any;
  let tx: any;
  const approval = {
    assertApprover: jest.fn().mockResolvedValue({ kind: 'default' }),
    getRow: jest.fn().mockResolvedValue(null),
  };

  const centralGood = {
    id: '00000000-0000-4000-8000-000000000002',
    type: 'GOOD',
    scope: 'SYSTEM',
    isActive: true,
  };
  const centralBad = {
    id: '00000000-0000-4000-8000-000000000001',
    type: 'BAD',
    scope: 'SYSTEM',
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
    receivedBy: 'sodo-1',
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
        expiryDate: null,
        product: { id: 'prod-1', name: 'iPhone 15' },
      },
      {
        id: 'gri-2',
        goodsReceiptId: 'gr-1',
        productId: 'prod-2',
        purchaseOrderItemId: null,
        quantityReceived: new Decimal(10),
        quantityAccepted: new Decimal(10),
        quantityRejected: new Decimal(0),
        batchNumber: null,
        serialNumber: null,
        expiryDate: null,
        product: { id: 'prod-2', name: 'Aksesoris X' },
      },
    ],
  };

  beforeEach(async () => {
    tx = {
      productStock: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'ps-new', quantityAvailable: new Decimal(0) }),
        update: jest.fn().mockResolvedValue({ id: 'ps-1' }),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'sm-1' }) },
      purchaseOrderItem: { findUnique: jest.fn() },
      purchaseOrder: { findUnique: jest.fn() },
      goodsReceiptEvent: { create: jest.fn().mockResolvedValue({ id: 'ev-1' }) },
      goodsReceiptItem: { update: jest.fn().mockResolvedValue({ id: 'gri-1' }) },
      goodsReceipt: {
        update: jest.fn().mockResolvedValue({
          id: 'gr-1',
          variancePercent: null,
          status: 'approved',
          items: [
            { ...gr.items[0], quantityReceived: new Decimal(4), quantityAccepted: new Decimal(4), quantityRejected: new Decimal(0), unitPrice: new Decimal(1000) },
          ],
        }),
      },
    };

    prisma = {
      goodsReceipt: { findUnique: jest.fn().mockResolvedValue(gr), update: jest.fn() },
      warehouse: {
        findFirst: jest.fn().mockResolvedValue(centralGood),
      },
      purchaseAttachment: { count: jest.fn().mockResolvedValue(0) },
      goodsReceiptEvent: { create: jest.fn().mockResolvedValue({ id: 'ev-1' }) },
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

  // ---------- Revisit ----------
  it('revisits a received GR: status revisit + reason + event row', async () => {
    tx.goodsReceipt.update.mockResolvedValue({ id: 'gr-1', status: 'revisit' });
    const dto: RevisitGoodsReceiptDto = { reason: 'Kuantitas tidak sesuai' };

    const result = await service.revisit('gr-1', dto, 'cso-1', ['CSO']);

    expect(tx.goodsReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'revisit', revisitReason: 'Kuantitas tidak sesuai' }),
      }),
    );
    expect(tx.goodsReceiptEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'revisit', actorId: 'cso-1', note: 'Kuantitas tidak sesuai' }),
      }),
    );
    expect(result.status).toBe('revisit');
  });

  it('does not revisit an approved GR', async () => {
    prisma.goodsReceipt.findUnique.mockResolvedValue({ ...gr, status: 'approved' });
    const dto: RevisitGoodsReceiptDto = { reason: 'x' };
    await expect(service.revisit('gr-1', dto, 'cso-1', ['CSO'])).rejects.toThrow(BadRequestException);
    expect(tx.goodsReceipt.update).not.toHaveBeenCalled();
  });

  it('allows revisit from draft (same status set as approve)', async () => {
    prisma.goodsReceipt.findUnique.mockResolvedValue({ ...gr, status: 'draft' });
    tx.goodsReceipt.update.mockResolvedValue({ id: 'gr-1', status: 'revisit' });
    const dto: RevisitGoodsReceiptDto = { reason: 'Dokumen belum lengkap' };
    const result = await service.revisit('gr-1', dto, 'cso-1', ['CSO']);
    expect(tx.goodsReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'revisit' }) }),
    );
    expect(result.status).toBe('revisit');
  });

  it('requires approver authority for revisit (settings override: roles)', async () => {
    approval.assertApprover.mockRejectedValueOnce(new ForbiddenException('no'));
    const dto: RevisitGoodsReceiptDto = { reason: 'x' };
    await expect(service.revisit('gr-1', dto, 'asa-1', ['ASA'])).rejects.toThrow(ForbiddenException);
  });

  // ---------- updateReceiving ----------
  it('updates receiving quantities, accepted = received - rejected, event row', async () => {
    const dto: UpdateReceivingDto = {
      items: [
        { id: 'gri-1', quantity_received: 10, quantity_rejected: 2 },
        { id: 'gri-2', quantity_received: 10, quantity_rejected: 0 },
      ],
    };

    const result = await service.updateReceiving('gr-1', dto, 'sodo-1', ['SODO']);

    const itemUpdate = tx.goodsReceiptItem.update;
    const calls = itemUpdate.mock.calls;
    expect(calls.length).toBe(2);
    expect(tx.goodsReceiptItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantityAccepted: expect.any(Decimal),
          quantityRejected: expect.any(Decimal),
        }),
      }),
    );
    const d1 = calls[0][0].data;
    expect(d1.quantityRejected.toNumber()).toBe(2);
    expect(d1.quantityAccepted.toNumber()).toBe(8);
    expect(tx.goodsReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'received' }) }),
    );
    expect(tx.goodsReceiptEvent.create).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('rejects edit with rejected > received', async () => {
    const dto: UpdateReceivingDto = {
      items: [{ id: 'gri-1', quantity_received: 2, quantity_rejected: 5 }],
    };
    await expect(service.updateReceiving('gr-1', dto, 'sodo-1', ['SODO'])).rejects.toThrow(BadRequestException);
  });

  it('rejects edit by non-processor (ASA)', async () => {
    prisma.goodsReceipt.findUnique.mockResolvedValue({ ...gr, receivedBy: 'sodo-1' });
    const dto: UpdateReceivingDto = {
      items: [{ id: 'gri-1', quantity_received: 4, quantity_rejected: 0 }],
    };
    await expect(service.updateReceiving('gr-1', dto, 'asa-1', ['ASA'])).rejects.toThrow(ForbiddenException);
  });

  it('flips revisit back to received on re-submission', async () => {
    prisma.goodsReceipt.findUnique.mockResolvedValue({ ...gr, status: 'revisit' });
    const dto: UpdateReceivingDto = {
      items: [{ id: 'gri-1', quantity_received: 4, quantity_rejected: 0 }],
    };
    await service.updateReceiving('gr-1', dto, 'sodo-1', ['SODO']);
    expect(tx.goodsReceipt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'received' }) }),
    );
  });

  // ---------- approve gates and rejected->bad ----------
  const approveDto = { inspection_status: 'passed', inspection_notes: null, notes: null } as any;

  it('blocks approve when mandatory invoice setting is on and no invoice attached', async () => {
    approval.getRow.mockResolvedValue({ mandatoryInvoice: true });
    prisma.purchaseAttachment.count.mockResolvedValue(0);
    await expect(service.approve('gr-1', approveDto, 'cso-1', ['CSO'])).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows approve when invoice is attached (mandatory on)', async () => {
    approval.getRow.mockResolvedValue({ mandatoryInvoice: true });
    prisma.purchaseAttachment.count.mockResolvedValue(1);
    await service.approve('gr-1', approveDto, 'cso-1', ['CSO']);
    expect(tx.productStock.update).toHaveBeenCalled();
  });

  it('lands rejected quantity in central-bad and accepted in central-good', async () => {
    const gr2 = {
      ...gr,
      items: [
        { ...gr.items[0], quantityAccepted: new Decimal(8), quantityRejected: new Decimal(2) },
        { ...gr.items[1], quantityAccepted: new Decimal(10), quantityRejected: new Decimal(0) },
      ],
    };
    prisma.goodsReceipt.findUnique.mockResolvedValue(gr2);
    prisma.warehouse.findFirst
      .mockResolvedValueOnce(centralGood)
      .mockResolvedValueOnce(centralBad);

    await service.approve('gr-1', approveDto, 'cso-1', ['CSO']);

    // accepted → central-good movement
    const goodMoves = tx.stockMovement.create.mock.calls
      .map((c: any) => c[0].data)
      .filter((m: any) => m.warehouseId === centralGood.id);
    const badMoves = tx.stockMovement.create.mock.calls
      .map((c: any) => c[0].data)
      .filter((m: any) => m.warehouseId === centralBad.id);
    expect(goodMoves.length).toBe(2);
    expect(badMoves.length).toBe(1);
    expect(badMoves[0].quantityChange.toNumber()).toBe(2);
    expect(badMoves[0].notes).toContain('rejected at receiving');
  });
});
