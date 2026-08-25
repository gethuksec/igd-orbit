import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateSalesReturnDto } from './dto';

/**
 * Stable ID of the one centralized system-scoped BAD warehouse
 * (seeded by backend/prisma/inventory-warehouse-stock.sql).
 * Returned goods land here directly — no manual transfer, never resold.
 */
export const CENTRAL_BAD_WAREHOUSE_ID = '00000000-0000-4000-8000-000000000001';

@Injectable()
export class SalesReturnsService {
  constructor(private prisma: PrismaService) {}

  private generateReturnNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `RET-${dateStr}-${random}`;
  }

  /**
   * Create a full-invoice sales return atomically:
   * - SUPERADMIN only (v1 per design decision; perm sales.retur.* later)
   * - source transaction status must be 'completed' -> flipped to 'retur'
   * - goods booked into the Central BAD warehouse (+available, movement IN / SALES_RETURN)
   * - settlement cash -> payments + paymentStatus marked refunded
   * - settlement exchange -> refund note only (manual: new transaction with alasan = retur no. X)
   * - nominal immutable = original invoice total
   */
  async create(dto: CreateSalesReturnDto, userId: string) {
    await this.assertSuperadmin(userId);

    const transaction = await this.prisma.salesTransaction.findUnique({
      where: { id: dto.transactionId },
      include: { items: true, customer: true, payments: true },
    });
    if (!transaction) {
      throw new NotFoundException('Transaksi tidak ditemukan');
    }
    // Status 'retur' is not 'completed', so already-returned transactions are rejected here.
    if (transaction.status !== 'completed') {
      throw new BadRequestException(
        'Retur hanya dapat dibuat dari transaksi berstatus Selesai',
      );
    }

    const refundAmount = transaction.total;

    return this.prisma.$transaction(async (tx) => {
      // 1. Create the retur record (snapshots COA pick)
      const retur = await tx.salesReturn.create({
        data: {
          returnNumber: this.generateReturnNumber(),
          transactionId: transaction.id,
          branchId: transaction.branchId,
          customerId: transaction.customerId,
          processedBy: userId,
          reason: dto.reason,
          settlementType: dto.settlementType,
          coaId: dto.coaId ?? null,
          refundAmount,
        },
      });

      // 2. Flip source transaction status to RETUR (≠ BATAL)
      await tx.salesTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'retur',
          paymentStatus:
            dto.settlementType === 'cash' ? 'refunded' : transaction.paymentStatus,
        },
      });

      // 3. Settlement cash -> mark payments refunded
      if (dto.settlementType === 'cash') {
        await tx.payment.updateMany({
          where: { transactionId: transaction.id },
          data: { status: 'refunded' },
        });
      }

      // 4. Stock: returned goods -> Central BAD warehouse (no manual transfer)
      const badWarehouse = await tx.warehouse.findUnique({
        where: { id: CENTRAL_BAD_WAREHOUSE_ID },
      });
      if (!badWarehouse) {
        throw new BadRequestException('Gudang BAD (Central Bad Stock) belum dikonfigurasi');
      }

      for (const item of transaction.items) {
        const qty = item.quantity.toNumber();
        const stock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: badWarehouse.id,
            },
          },
        });
        const before = stock ? stock.quantityAvailable.toNumber() : 0;
        const after = before + qty;

        await tx.productStock.upsert({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: badWarehouse.id,
            },
          },
          create: {
            productId: item.productId,
            warehouseId: badWarehouse.id,
            branchId: null, // system-scoped warehouse
            quantityAvailable: new Decimal(after),
          },
          update: { quantityAvailable: new Decimal(after) },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            warehouseId: badWarehouse.id,
            branchId: null, // system-scoped warehouse
            movementType: 'IN',
            referenceType: 'SALES_RETURN',
            referenceId: retur.id,
            quantityChange: new Decimal(qty),
            quantityBefore: new Decimal(before),
            quantityAfter: new Decimal(after),
            batchNumber: item.batchNumber || null,
            serialNumber: item.serialNumber || null,
            createdBy: userId,
            notes: `Retur ${retur.returnNumber} · ${transaction.transactionNumber}`,
          },
        });
      }

      return this.prisma.salesReturn.findUniqueOrThrow({
        where: { id: retur.id },
        include: { transaction: true, customer: true, coa: true },
      });
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    transactionId?: string;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const where: any = {};

    if (query.transactionId) {
      where.transactionId = query.transactionId;
    }
    if (query.search) {
      const q = query.search;
      where.OR = [
        { returnNumber: { contains: q, mode: 'insensitive' } },
        { reason: { contains: q, mode: 'insensitive' } },
        {
          transaction: {
            transactionNumber: { contains: q, mode: 'insensitive' },
          },
        },
        { customer: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.salesReturn.findMany({
        where,
        include: {
          transaction: { select: { transactionNumber: true, status: true } },
          customer: { select: { id: true, name: true } },
          coa: { select: { id: true, code: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.salesReturn.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const retur = await this.prisma.salesReturn.findUnique({
      where: { id },
      include: {
        transaction: { include: { items: true, branch: true } },
        customer: true,
        coa: true,
      },
    });
    if (!retur) {
      throw new NotFoundException('Retur tidak ditemukan');
    }
    return retur;
  }

  /** Retur info for a transaction, used on the transaction detail page. */
  async findByTransaction(transactionId: string) {
    return this.prisma.salesReturn.findFirst({
      where: { transactionId },
      include: {
        transaction: { select: { transactionNumber: true, status: true } },
        customer: { select: { id: true, name: true } },
        coa: { select: { id: true, code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async assertSuperadmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userBranches: {
          select: { role: { select: { code: true } } },
        },
      },
    });
    const roles = user?.userBranches?.map((ub: any) => ub.role.code) || [];
    if (!roles.includes('SUPERADMIN')) {
      throw new ForbiddenException('Hanya SUPERADMIN yang dapat membuat retur (v1)');
    }
  }
}
