import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { SalesReturnsService, CENTRAL_BAD_WAREHOUSE_ID } from './sales-returns.service';
import { CreateSalesReturnDto } from './dto';

describe('SalesReturnsService', () => {
  let service: SalesReturnsService;
  let prisma: { [k: string]: any };

  const superadminUser = {
    id: 'user-sa',
    userBranches: [{ role: { code: 'SUPERADMIN' } }],
  };
  const staffUser = {
    id: 'user-staff',
    userBranches: [{ role: { code: 'CS' } }],
  };

  const completedTransaction = {
    id: 'trx-1',
    transactionNumber: 'TRX-20260825-000142',
    status: 'completed',
    branchId: 'branch-1',
    customerId: 'cust-1',
    total: new Decimal(1250000),
    paymentStatus: 'paid',
    items: [
      {
        productId: 'prod-1',
        quantity: new Decimal(2),
        batchNumber: null,
        serialNumber: null,
      },
    ],
    customer: { id: 'cust-1', name: 'Budi Santoso' },
    payments: [{ id: 'pay-1', status: 'completed' }],
  };

  const badWarehouse = {
    id: CENTRAL_BAD_WAREHOUSE_ID,
    code: 'CENTRAL-BAD',
    type: 'BAD',
    scope: 'SYSTEM',
  };

  const dto: CreateSalesReturnDto = {
    transactionId: 'trx-1',
    reason: 'barang cacat (retak)',
    settlementType: 'cash',
  };

  const createdRetur = {
    id: 'retur-1',
    returnNumber: 'RET-20260825-000001',
    transactionId: 'trx-1',
    branchId: 'branch-1',
    customerId: 'cust-1',
    processedBy: 'user-sa',
    reason: dto.reason,
    settlementType: 'cash',
    coaId: null,
    refundAmount: new Decimal(1250000),
  };

  const txMock = () => ({
    salesReturn: {
      create: jest.fn().mockResolvedValue(createdRetur),
      findUniqueOrThrow: jest.fn().mockResolvedValue(createdRetur),
    },
    salesTransaction: {
      update: jest.fn().mockResolvedValue({ id: 'trx-1' }),
    },
    payment: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    warehouse: {
      findUnique: jest.fn().mockResolvedValue(badWarehouse),
    },
    productStock: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: 'ps-bad' }),
    },
    stockMovement: {
      create: jest.fn().mockResolvedValue({ id: 'sm-1' }),
    },
  });

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      salesTransaction: { findUnique: jest.fn() },
      salesReturn: {
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      warehouse: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesReturnsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SalesReturnsService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('rejects non-SUPERADMIN users (v1 permission)', async () => {
      prisma.user.findUnique.mockResolvedValue(staffUser);
      await expect(service.create(dto, 'user-staff')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.salesTransaction.findUnique).not.toHaveBeenCalled();
    });

    it('rejects when transaction is not found', async () => {
      prisma.user.findUnique.mockResolvedValue(superadminUser);
      prisma.salesTransaction.findUnique.mockResolvedValue(null);
      await expect(service.create(dto, 'user-sa')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects when transaction is not completed (incl. already returned)', async () => {
      prisma.user.findUnique.mockResolvedValue(superadminUser);
      prisma.salesTransaction.findUnique.mockResolvedValue({
        ...completedTransaction,
        status: 'retur',
      });
      await expect(service.create(dto, 'user-sa')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates retur, flips status, refunds payments, books stock into BAD warehouse (cash)', async () => {
      prisma.user.findUnique.mockResolvedValue(superadminUser);
      prisma.salesTransaction.findUnique.mockResolvedValue(completedTransaction);
      prisma.salesReturn.findUniqueOrThrow.mockResolvedValue(createdRetur);
      const tx = txMock();
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));

      const result = await service.create(dto, 'user-sa');

      expect(result).toEqual(createdRetur);
      expect(tx.salesReturn.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          transactionId: 'trx-1',
          settlementType: 'cash',
          reason: dto.reason,
          refundAmount: new Decimal(1250000),
        }),
      });
      expect(tx.salesTransaction.update).toHaveBeenCalledWith({
        where: { id: 'trx-1' },
        data: expect.objectContaining({ status: 'retur', paymentStatus: 'refunded' }),
      });
      expect(tx.payment.updateMany).toHaveBeenCalledWith({
        where: { transactionId: 'trx-1' },
        data: { status: 'refunded' },
      });
      expect(tx.productStock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            productId_warehouseId: {
              productId: 'prod-1',
              warehouseId: CENTRAL_BAD_WAREHOUSE_ID,
            },
          },
        }),
      );
      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          productId: 'prod-1',
          warehouseId: CENTRAL_BAD_WAREHOUSE_ID,
          movementType: 'IN',
          referenceType: 'SALES_RETURN',
          referenceId: 'retur-1',
          quantityChange: new Decimal(2),
        }),
      });
    });

    it('does not refund payments for exchange settlement', async () => {
      prisma.user.findUnique.mockResolvedValue(superadminUser);
      prisma.salesTransaction.findUnique.mockResolvedValue(completedTransaction);
      prisma.salesReturn.findUniqueOrThrow.mockResolvedValue(createdRetur);
      const tx = txMock();
      prisma.$transaction.mockImplementation((cb: any) => cb(tx));

      await service.create({ ...dto, settlementType: 'exchange' }, 'user-sa');

      expect(tx.salesTransaction.update).toHaveBeenCalledWith({
        where: { id: 'trx-1' },
        data: expect.objectContaining({
          status: 'retur',
          paymentStatus: 'paid',
        }),
      });
      expect(tx.payment.updateMany).not.toHaveBeenCalled();
    });

    it('throws when Central BAD warehouse is not configured', async () => {
      prisma.user.findUnique.mockResolvedValue(superadminUser);
      prisma.salesTransaction.findUnique.mockResolvedValue(completedTransaction);
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = txMock();
        tx.warehouse.findUnique.mockResolvedValue(null);
        return cb(tx);
      });
      await expect(service.create(dto, 'user-sa')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated list and applies search', async () => {
      prisma.salesReturn.findMany.mockResolvedValue([{ id: 'retur-1' }]);
      prisma.salesReturn.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20, search: 'cacat' });

      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(prisma.salesReturn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ OR: expect.any(Array) }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFound when missing', async () => {
      prisma.salesReturn.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });

    it('returns retur with transaction detail', async () => {
      prisma.salesReturn.findUnique.mockResolvedValue({ id: 'retur-1' });
      const result = await service.findOne('retur-1');
      expect(result).toEqual({ id: 'retur-1' });
      expect(prisma.salesReturn.findUnique).toHaveBeenCalledWith({
        where: { id: 'retur-1' },
        include: expect.objectContaining({ transaction: expect.any(Object) }),
      });
    });
  });

  describe('findByTransaction', () => {
    it('looks up first retur for a transaction', async () => {
      prisma.salesReturn.findFirst.mockResolvedValue(createdRetur);
      const result = await service.findByTransaction('trx-1');
      expect(result).toEqual(createdRetur);
      expect(prisma.salesReturn.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { transactionId: 'trx-1' } }),
      );
    });
  });
});
