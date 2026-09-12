import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { ServiceOrdersService } from './service-orders.service';

describe('ServiceOrdersService payment auto-done + void (IGDERP-171)', () => {
  let service: ServiceOrdersService;
  let prisma: any;

  const tx = {
    serviceOrder: { update: jest.fn() },
    serviceStatusHistory: { create: jest.fn() },
  };

  const salesMock = {
    findByServiceOrderId: jest.fn(() => Promise.resolve(null)),
    createNoServiceFromParts: jest.fn((a: any) => Promise.resolve({ id: 'tx-1', ...a })),
    markPaidForServiceOrder: jest.fn(() => Promise.resolve({ id: 'tx-1' })),
    reopenForServiceOrder: jest.fn(() => Promise.resolve({ id: 'tx-1' })),
  };

  const journalMock = { autoGenerateFromServicePayment: jest.fn(() => Promise.resolve(null)) };
  const approvalMock = { assertApprover: jest.fn(() => Promise.resolve({ kind: 'default' })) };

  const readyOrder = (over: Record<string, any> = {}) => ({
    id: 'so-1',
    status: 'ready',
    branchId: 'br-1',
    totalPrice: new Decimal(1000000),
    downPayment: new Decimal(0),
    invoiceNumber: 'INV-1',
    paymentStatus: 'pending',
    paymentMethod: null,
    paidAt: null,
    internalNotes: null,
    warrantyDays: 30,
    partsUsed: [],
    ...over,
  });

  beforeEach(() => {
    prisma = {
      serviceOrder: { findUnique: jest.fn(), update: jest.fn() },
      serviceStatusHistory: { create: jest.fn() },
      serviceType: { findUnique: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    service = new ServiceOrdersService(prisma, journalMock as any, salesMock as any, approvalMock as any);
    jest.clearAllMocks();
  });

  it('auto-flips ready → done when payment completes the balance', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(readyOrder());
    tx.serviceOrder.update.mockImplementation((args: any) =>
      Promise.resolve({ id: 'so-1', status: 'ready', paymentStatus: 'paid', ...args.data }),
    );
    tx.serviceStatusHistory.create.mockResolvedValue({ id: 'h-1' });

    const out: any = await service.processPayment(
      'so-1',
      { paymentMethod: 'cash', amount: 1000000 } as any,
      'cs-1',
    );

    expect(out.status).toBe('done');
    expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'done', previousStatus: 'ready' }),
      }),
    );
    // linked POS faktur still marked paid after the flip
    expect(salesMock.markPaidForServiceOrder).toHaveBeenCalled();
  });

  it('stays in ready on partial payment (no auto-done)', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(readyOrder());
    tx.serviceOrder.update.mockImplementation((args: any) =>
      Promise.resolve({ id: 'so-1', status: 'ready', paymentStatus: 'partial', ...args.data }),
    );
    tx.serviceStatusHistory.create.mockResolvedValue({ id: 'h-1' });

    await service.processPayment('so-1', { paymentMethod: 'transfer', amount: 400000 } as any, 'cs-1');

    const statuses = tx.serviceStatusHistory.create.mock.calls.map((c: any) => c[0].data.status);
    expect(statuses).not.toContain('done');
    expect(salesMock.markPaidForServiceOrder).not.toHaveBeenCalled();
  });

  it('void reopens done+paid → ready+pending with audit (approver allowed)', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(
      readyOrder({ status: 'done', paymentStatus: 'paid' }),
    );
    tx.serviceOrder.update.mockImplementation((args: any) =>
      Promise.resolve({ id: 'so-1', ...args.data }),
    );
    tx.serviceStatusHistory.create.mockResolvedValue({ id: 'h-1' });

    const out: any = await service.voidPayment(
      'so-1',
      { reason: 'salah input metode' } as any,
      'spv-1',
      ['SPV'],
    );

    expect(approvalMock.assertApprover).toHaveBeenCalledWith(
      'SERVICE_PAYMENT_VOID',
      'spv-1',
      ['SPV'],
    );
    expect(out.status).toBe('ready');
    expect(out.paymentStatus).toBe('pending');
    expect(Number(out.downPayment)).toBe(0);
    expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ready',
          previousStatus: 'done',
          notes: expect.stringContaining('salah input metode'),
        }),
      }),
    );
    expect(salesMock.reopenForServiceOrder).toHaveBeenCalledWith('so-1');
  });

  it('void rejects when approver lacks authority', async () => {
    approvalMock.assertApprover.mockRejectedValueOnce(new ForbiddenException('nope'));
    prisma.serviceOrder.findUnique.mockResolvedValue(
      readyOrder({ status: 'done', paymentStatus: 'paid' }),
    );

    await expect(
      service.voidPayment('so-1', { reason: 'x' } as any, 'cs-1', ['CS']),
    ).rejects.toThrow(ForbiddenException);
    expect(tx.serviceOrder.update).not.toHaveBeenCalled();
  });

  it('void rejects unless done+paid', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(
      readyOrder({ status: 'ready', paymentStatus: 'partial' }),
    );

    await expect(
      service.voidPayment('so-1', { reason: 'x' } as any, 'spv-1', ['SPV']),
    ).rejects.toThrow(BadRequestException);
  });
});
