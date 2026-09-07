import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { PurchaseAttachmentsService } from './services/purchase-attachments.service';

jest.mock('fs');
import { existsSync, writeFileSync } from 'fs';
const mkExists = existsSync as jest.Mock;

describe('PurchaseAttachmentsService (IGDERP-81)', () => {
  let service: PurchaseAttachmentsService;
  let prisma: {
    purchaseOrder: { findUnique: jest.Mock };
    goodsReceipt: { findUnique: jest.Mock };
    purchaseAttachment: { createMany: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; delete: jest.Mock };
  };

  const file = (name: string, mimetype: string, size = 1024) => ({
    originalname: name,
    mimetype,
    size,
    buffer: Buffer.from('x'),
  });

  beforeEach(async () => {
    mkExists.mockReturnValue(true);
    prisma = {
      purchaseOrder: { findUnique: jest.fn().mockResolvedValue({ id: 'po-1' }) },
      goodsReceipt: { findUnique: jest.fn().mockResolvedValue({ id: 'gr-1' }) },
      purchaseAttachment: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ id: 'att-1', filePath: '/uploads/purchase-docs/x.pdf' }),
        delete: jest.fn().mockResolvedValue({ id: 'att-1' }),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [PurchaseAttachmentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<PurchaseAttachmentsService>(PurchaseAttachmentsService);
  });

  it('rejects invalid entityType', async () => {
    await expect(
      service.upload('WHATEVER', 'x', 'INVOICE', [file('a.pdf', 'application/pdf')], 'u1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unsupported mime types', async () => {
    await expect(
      service.upload('GOODS_RECEIPT', 'gr-1', 'INVOICE', [file('a.exe', 'application/octet-stream')], 'u1'),
    ).rejects.toThrow(BadRequestException);
    expect(writeFileSync).not.toHaveBeenCalled();
  });

  it('rejects files over 10MB', async () => {
    await expect(
      service.upload('GOODS_RECEIPT', 'gr-1', 'INVOICE', [file('big.pdf', 'application/pdf', 11 * 1024 * 1024)], 'u1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('saves multiple files and creates rows', async () => {
    await service.upload('GOODS_RECEIPT', 'gr-1', 'INVOICE', [file('invoice.pdf', 'application/pdf'), file('do.jpg', 'image/jpeg')], 'u1');
    expect(writeFileSync).toHaveBeenCalledTimes(2);
    expect(prisma.purchaseAttachment.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ entityType: 'GOODS_RECEIPT', documentType: 'INVOICE', uploadedBy: 'u1' })]) }),
    );
  });

  it('checks entity existence for PO and GR', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue(null);
    await expect(
      service.upload('PURCHASE_ORDER', 'po-x', 'INVOICE', [file('a.pdf', 'application/pdf')], 'u1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('lists and removes attachments', async () => {
    await service.list('GOODS_RECEIPT', 'gr-1');
    expect(prisma.purchaseAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { entityType: 'GOODS_RECEIPT', entityId: 'gr-1' } }),
    );
    const res = await service.remove('att-1', 'u1');
    expect(res.deleted).toBe(true);
    expect(prisma.purchaseAttachment.delete).toHaveBeenCalledWith({ where: { id: 'att-1' } });
  });
});
