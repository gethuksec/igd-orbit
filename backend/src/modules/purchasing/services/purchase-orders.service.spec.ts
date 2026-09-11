import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../shared/services/prisma.service';
import { PurchaseOrdersService } from './purchase-orders.service';

describe('PurchaseOrdersService IGDERP-82 flows (create->pending, reject, update-from-pending)', () => {
  let service: PurchaseOrdersService;
  let prisma: any;

  const poBase = {
    id: 'po-1',
    poNumber: 'PO-20260907-000001',
    status: 'pending',
    branchId: 'branch-1',
    supplierId: 'sup-1',
    totalAmount: new Decimal(12_400_000),
    subtotal: new Decimal(12_400_000),
    discountAmount: new Decimal(0),
    taxAmount: new Decimal(0),
    shippingCost: new Decimal(0),
    notes: null,
    approvedBy: null,
    approvedBy2: null,
    approvedAt: null,
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: null,
    cancelledBy: null,
    cancelledAt: null,
    cancellationReason: null,
    items: [
      {
        id: 'poi-1',
        productId: 'prod-1',
        quantityOrdered: new Decimal(100),
        quantityReceived: new Decimal(0),
        unitPrice: new Decimal(85_000),
      },
    ],
  };

  beforeEach(async () => {
    prisma = {
      purchaseOrder: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      customer: { findUnique: jest.fn() },
      branch: { findUnique: jest.fn(), findFirst: jest.fn() },
      product: { findUnique: jest.fn() },
      userBranch: { findFirst: jest.fn() },
      approvalSetting: { findUnique: jest.fn() },
      purchaseAttachment: { count: jest.fn() },
    };

    // a4353fe9 defaults: no settings row → invoice gate ON; invoice present.
    prisma.approvalSetting.findUnique.mockResolvedValue(null);
    prisma.purchaseAttachment.count.mockResolvedValue(1);

    prisma.$transaction = jest.fn(async (callback: any) =>
      callback({
        purchaseOrderItem: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        purchaseOrder: {
          update: jest.fn().mockResolvedValue({
            id: 'po-1',
            subtotal: new Decimal(0),
            discountAmount: new Decimal(0),
            taxAmount: new Decimal(0),
            shippingCost: new Decimal(0),
            totalAmount: new Decimal(0),
            items: [],
          }),
        },
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PurchaseOrdersService);
  });

  it('creates a PO with status pending (draft removed)', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'sup-1', customerType: 'wholesale' });
    prisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
    prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
    prisma.purchaseOrder.create.mockResolvedValue({ id: 'po-1', status: 'pending' });

    await service.create(
      {
        supplier_id: 'sup-1',
        branch_id: 'branch-1',
        invoice_number: 'INV-001',
        invoice_date: '2026-09-05',
        order_date: '2026-09-07',
        expected_delivery_date: '2026-09-10',
        items: [{ product_id: 'prod-1', quantity_ordered: 10, unit_price: 1000 }],
      } as any,
      'cso-1',
    );

    const createCall = prisma.purchaseOrder.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('pending');
    expect(createCall.data.invoiceNumber).toBe('INV-001');
  });

  it('allows update while pending (creator corrections before approval)', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({ ...poBase, status: 'pending', items: [] });
    prisma.customer.findUnique.mockResolvedValue({ id: 'sup-1', customerType: 'wholesale' });
    prisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
    prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
    prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1' });

    await service.update(
      'po-1',
      { notes: 'updated', items: [{ product_id: 'prod-1', quantity_ordered: 5, unit_price: 1000 }] } as any,
      'cso-1',
    );
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects a pending PO (authority via tier)', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue(poBase);
    prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1', status: 'rejected' });

    const result = await service.reject('po-1', { reason: 'Harga tidak sesuai' }, 'cfo-1', ['CFO']);
    const updateCall = prisma.purchaseOrder.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('rejected');
    expect(updateCall.data.rejectedBy).toBe('cfo-1');
    expect(updateCall.data.rejectionReason).toBe('Harga tidak sesuai');
    expect(result.status).toBe('rejected');
  });

  it('blocks reject for POs not pending', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({ ...poBase, status: 'approved' });
    await expect(service.reject('po-1', { reason: 'x' }, 'cso-1', ['CSO'])).rejects.toThrow(
      BadRequestException,
    );
  });

  it('blocks reject without tier authority', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({ ...poBase, totalAmount: new Decimal(12_000_000) });
    await expect(service.reject('po-1', { reason: 'x' }, 'hs-1', ['HS'])).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('allows SUPERADMIN to reject', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({ ...poBase, totalAmount: new Decimal(12_000_000) });
    prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1', status: 'rejected' });
    const result = await service.reject('po-1', { reason: 'x' }, 'root', ['SUPERADMIN']);
    expect(result.status).toBe('rejected');
  });

  it('allows SUPERADMIN to approve (admin bypass)', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({
      ...poBase,
      totalAmount: new Decimal(3_000_000),
    });
    prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1', status: 'approved', approvedBy: 'root' });
    const result = await service.approve('po-1', {}, 'root', ['SUPERADMIN']);
    expect(result.status).toBe('approved');
  });

  it('reject on missing PO throws NotFound', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue(null);
    await expect(service.reject('po-x', { reason: 'x' }, 'cso-1', ['CSO'])).rejects.toThrow(NotFoundException);
  });

  // ---------- IGDERP-79: invoice creation + transit semantics (8 Sep) ----------
  it('IGDERP-79: blocks create without supplier invoice number', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'sup-1', customerType: 'wholesale' });
    await expect(
      service.create(
        {
          supplier_id: 'sup-1',
          branch_id: 'branch-1',
          order_date: '2026-09-07',
          items: [{ product_id: 'prod-1', quantity_ordered: 10, unit_price: 1000 }],
        } as any,
        'cso-1',
      ),
    ).rejects.toThrow('Nomor invoice supplier wajib diisi');
    expect(prisma.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it('IGDERP-79: blocks create without supplier invoice date', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'sup-1', customerType: 'wholesale' });
    prisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
    await expect(
      service.create(
        {
          supplier_id: 'sup-1',
          branch_id: 'branch-1',
          invoice_number: 'INV-001',
          order_date: '2026-09-07',
          items: [{ product_id: 'prod-1', quantity_ordered: 10, unit_price: 1000 }],
        } as any,
        'cso-1',
      ),
    ).rejects.toThrow('Tanggal invoice supplier wajib diisi');
  });

  it('blocks create without Perkiraan Barang Diterima', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'sup-1', customerType: 'wholesale' });
    prisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
    await expect(
      service.create(
        {
          supplier_id: 'sup-1',
          branch_id: 'branch-1',
          invoice_number: 'INV-001',
          invoice_date: '2026-09-05',
          order_date: '2026-09-07',
          items: [{ product_id: 'prod-1', quantity_ordered: 10, unit_price: 1000 }],
        } as any,
        'cso-1',
      ),
    ).rejects.toThrow('Perkiraan barang diterima wajib diisi');
    expect(prisma.purchaseOrder.create).not.toHaveBeenCalled();
  });

  it('IGDERP-79: computes dueDate = invoice date + payment term days', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'sup-1', customerType: 'wholesale' });
    prisma.branch.findUnique.mockResolvedValue({ id: 'branch-1' });
    prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
    prisma.purchaseOrder.create.mockResolvedValue({ id: 'po-1', status: 'pending' });

    await service.create(
      {
        supplier_id: 'sup-1',
        branch_id: 'branch-1',
        invoice_number: 'INV-001',
        invoice_date: '2026-09-05',
        order_date: '2026-09-05',
        expected_delivery_date: '2026-09-08',
        payment_term_days: 30,
        items: [{ product_id: 'prod-1', quantity_ordered: 10, unit_price: 1000 }],
      } as any,
      'cso-1',
    );

    const data = prisma.purchaseOrder.create.mock.calls[0][0].data;
    expect(data.dueDate).toEqual(new Date('2026-10-05T00:00:00.000Z'));
  });

  it('IGDERP-79: auto-fills branch from the creator when branch_id is omitted', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 'sup-1', customerType: 'wholesale' });
    prisma.userBranch.findFirst.mockResolvedValue({ branchId: 'branch-2' });
    prisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
    prisma.purchaseOrder.create.mockResolvedValue({ id: 'po-1' });

    await service.create(
      {
        supplier_id: 'sup-1',
        invoice_number: 'INV-002',
        invoice_date: '2026-09-05',
        order_date: '2026-09-05',
        expected_delivery_date: '2026-09-08',
        items: [{ product_id: 'prod-1', quantity_ordered: 1, unit_price: 1000 }],
      } as any,
      'sodo-1',
    );

    const data = prisma.purchaseOrder.create.mock.calls[0][0].data;
    expect(data.branchId).toBe('branch-2');
  });

  // ---------- a4353fe9: mandatory invoice upload before approve ----------
  it('a4353fe9: blocks approve when invoice is not attached (default ON)', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({ ...poBase, totalAmount: new Decimal(3_000_000) });
    prisma.purchaseAttachment.count.mockResolvedValue(0);

    await expect(service.approve('po-1', {}, 'cso-1', ['CSO'])).rejects.toThrow(
      'Invoice wajib diunggah sebelum approve',
    );
    expect(prisma.purchaseOrder.update).not.toHaveBeenCalled();
  });

  it('a4353fe9: allows approve once the invoice document exists', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({ ...poBase, totalAmount: new Decimal(3_000_000) });
    prisma.purchaseAttachment.count.mockResolvedValue(1);
    prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1', status: 'approved', approvedBy: 'cso-1' });

    const result = await service.approve('po-1', {}, 'cso-1', ['CSO']);

    expect(result.status).toBe('approved');
    expect(prisma.purchaseAttachment.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entityType: 'PURCHASE_ORDER', documentType: 'INVOICE' }),
      }),
    );
  });

  it('a4353fe9: explicit OFF in approval settings disables the invoice gate', async () => {
    prisma.purchaseOrder.findUnique.mockResolvedValue({ ...poBase, totalAmount: new Decimal(3_000_000) });
    prisma.approvalSetting.findUnique.mockResolvedValue({
      category: 'PURCHASE_INVOICE',
      mandatoryInvoice: false,
    });
    prisma.purchaseAttachment.count.mockResolvedValue(0);
    prisma.purchaseOrder.update.mockResolvedValue({ id: 'po-1', status: 'approved', approvedBy: 'cso-1' });

    const result = await service.approve('po-1', {}, 'cso-1', ['CSO']);
    expect(result.status).toBe('approved');
  });
});
