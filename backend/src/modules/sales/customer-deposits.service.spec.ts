import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { CustomerDepositsService } from './customer-deposits.service';
import { CreateCustomerDepositDto } from './dto';

describe('CustomerDepositsService', () => {
  let service: CustomerDepositsService;
  let prisma: { [k: string]: any };

  const customer = {
    id: 'cust-1',
    name: 'Budi Santoso',
    depositBalance: new Decimal(750000),
  };

  beforeEach(async () => {
    prisma = {
      customer: { findUnique: jest.fn() },
      salesTransaction: { findUnique: jest.fn() },
      customerDeposit: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerDepositsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(CustomerDepositsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createReturnDeposit', () => {
    const dto: CreateCustomerDepositDto = {
      customerId: 'cust-1',
      amount: 450000,
      type: 'return_credit',
      referenceId: 'trx-1',
      notes: 'Retur Penjualan',
    };

    let tx: any;

    beforeEach(() => {
      prisma.customer.findUnique.mockResolvedValue(customer);
      prisma.salesTransaction.findUnique.mockResolvedValue({ id: 'trx-1' });
      tx = {
        customerDeposit: {
          create: jest.fn().mockResolvedValue({ id: 'dep-1', amount: new Decimal(450000) }),
        },
        customer: {
          update: jest.fn().mockResolvedValue({ id: 'cust-1' }),
        },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));
    });

    it('rejects non-return_credit type', async () => {
      await expect(
        service.createReturnDeposit({ ...dto, type: 'payment_used' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unknown customer', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.createReturnDeposit(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects unknown reference transaction', async () => {
      prisma.salesTransaction.findUnique.mockResolvedValue(null);
      await expect(service.createReturnDeposit(dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('credits balance WITHOUT voiding the source transaction (IGDERP-102 hardening)', async () => {
      const result = await service.createReturnDeposit(dto, 'user-1');

      expect(result).toEqual({ id: 'dep-1', amount: new Decimal(450000) });

      // The legacy auto-void is gone: no salesTransaction mutation on the tx.
      expect((tx as any).salesTransaction).toBeUndefined();
      expect(tx.customerDeposit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: 'cust-1',
          amount: 450000,
          type: 'return_credit',
          referenceId: 'trx-1',
        }),
      });
      expect(tx.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { depositBalance: { increment: 450000 } },
      });
    });
  });

  describe('useDeposit', () => {
    it('rejects amount higher than balance', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        ...customer,
        depositBalance: new Decimal(100000),
      });
      await expect(service.useDeposit('cust-1', 200000)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates a negative ledger entry and decrements balance', async () => {
      prisma.customer.findUnique.mockResolvedValue(customer);
      const tx = {
        customerDeposit: {
          create: jest.fn().mockResolvedValue({ id: 'dep-2', amount: new Decimal(-750000) }),
        },
        customer: { update: jest.fn() },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));

      const result = await service.useDeposit('cust-1', 750000, 'trx-2');

      expect(tx.customerDeposit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: 'cust-1',
          amount: -750000,
          type: 'payment_used',
        }),
      });
      expect(tx.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-1' },
        data: { depositBalance: { decrement: 750000 } },
      });
      expect(result).toEqual({ id: 'dep-2', amount: new Decimal(-750000) });
    });
  });

  describe('refundDeposit', () => {
    it('rejects amount higher than balance', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        ...customer,
        depositBalance: new Decimal(100000),
      });
      await expect(service.refundDeposit('cust-1', 200000)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('decrements balance with refund type', async () => {
      prisma.customer.findUnique.mockResolvedValue(customer);
      const tx = {
        customerDeposit: {
          create: jest.fn().mockResolvedValue({ id: 'dep-3', amount: new Decimal(-300000) }),
        },
        customer: { update: jest.fn() },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));

      await service.refundDeposit('cust-1', 300000, 'refund tunai');

      expect(tx.customerDeposit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: 'cust-1',
          amount: -300000,
          type: 'refund',
          notes: 'refund tunai',
        }),
      });
    });
  });

  describe('getDepositBalance', () => {
    it('returns depositBalance as number', async () => {
      prisma.customer.findUnique.mockResolvedValue(customer);
      const balance = await service.getDepositBalance('cust-1');
      expect(balance).toBe(750000);
    });

    it('rejects unknown customer', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.getDepositBalance('x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDepositHistory', () => {
    it('rejects unknown customer', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.getDepositHistory('x')).rejects.toThrow(NotFoundException);
    });

    it('returns newest-first entries with running balance and pagination', async () => {
      prisma.customer.findUnique.mockResolvedValue(customer);
      prisma.customerDeposit.findMany.mockResolvedValue([
        { id: 'd1', amount: new Decimal(110), type: 'return_credit', referenceId: null, notes: null, createdAt: new Date('2026-08-21T00:00:00Z') },
        { id: 'd2', amount: new Decimal(-10), type: 'payment_used', referenceId: 't1', notes: null, createdAt: new Date('2026-08-25T00:00:00Z') },
        { id: 'd3', amount: new Decimal(-100), type: 'payment_used', referenceId: 't2', notes: null, createdAt: new Date('2026-08-25T01:00:00Z') },
      ]);

      const result = await service.getDepositHistory('cust-1', { page: 1, limit: 10 });

      // newest first: d3 (balance 0) → d2 (balance 100) → d1 (balance 110)
      expect(result.data.map((d: any) => d.id)).toEqual(['d3', 'd2', 'd1']);
      expect(result.data[0].runningBalance).toBe(0);
      expect(result.data[1].runningBalance).toBe(100);
      expect(result.data[2].runningBalance).toBe(110);
      expect(result.meta).toEqual({ page: 1, limit: 10, total: 3, totalPages: 1 });
    });
  });
});
