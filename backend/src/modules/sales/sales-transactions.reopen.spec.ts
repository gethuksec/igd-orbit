import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { SalesTransactionsService } from './sales-transactions.service';

describe('SalesTransactionsService.reopenForServiceOrder (IGDERP-171)', () => {
  let service: SalesTransactionsService;
  let prisma: any;

  const faktur = (over: Record<string, any> = {}) => ({
    id: 'tx-1',
    paymentStatus: 'paid',
    total: new Decimal(100000),
    ...over,
  });

  beforeEach(() => {
    prisma = {
      salesTransaction: { findFirst: jest.fn(), update: jest.fn() },
      payment: { findMany: jest.fn(), deleteMany: jest.fn() },
      $transaction: jest.fn(),
    };
    // inner-tx delegates resolve onto the shared mock
    prisma.$transaction.mockImplementation((fn: any) =>
      fn({
        payment: prisma.payment,
        salesTransaction: prisma.salesTransaction,
      }),
    );
    service = new SalesTransactionsService(prisma, {} as any, {} as any);
    jest.clearAllMocks();
  });

  it('reverses a clean auto-payment (single payment == total)', async () => {
    prisma.salesTransaction.findFirst.mockResolvedValue(faktur());
    prisma.payment.findMany.mockResolvedValue([
      { id: 'pay-1', amount: new Decimal(100000), status: 'completed' },
    ]);
    prisma.payment.deleteMany.mockResolvedValue({ count: 1 });
    prisma.salesTransaction.update.mockResolvedValue({ id: 'tx-1', paymentStatus: 'pending' });

    const out: any = await service.reopenForServiceOrder('so-1');

    expect(prisma.payment.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { transactionId: 'tx-1' } }),
    );
    expect(out.paymentStatus).toBe('pending');
  });

  it('refuses when manual POS payments exist', async () => {
    prisma.salesTransaction.findFirst.mockResolvedValue(faktur());
    prisma.payment.findMany.mockResolvedValue([
      { id: 'pay-1', amount: new Decimal(60000), status: 'completed' },
      { id: 'pay-2', amount: new Decimal(40000), status: 'completed' },
    ]);

    await expect(service.reopenForServiceOrder('so-1')).rejects.toThrow(BadRequestException);
    expect(prisma.payment.deleteMany).not.toHaveBeenCalled();
  });

  it('returns null when nothing to reopen', async () => {
    prisma.salesTransaction.findFirst.mockResolvedValue(null);
    await expect(service.reopenForServiceOrder('so-1')).resolves.toBeNull();

    prisma.salesTransaction.findFirst.mockResolvedValue(faktur({ paymentStatus: 'pending' }));
    await expect(service.reopenForServiceOrder('so-1')).resolves.toBeNull();
  });
});
