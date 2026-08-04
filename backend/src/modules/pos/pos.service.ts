import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreatePosTransactionDto } from './dto/create-pos-transaction.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class PosService {
  constructor(private prisma: PrismaService) {}

  // ════════════════════════════════════════════
  // TRANSACTION
  // ════════════════════════════════════════════

  async createTransaction(dto: CreatePosTransactionDto, userId: string) {
    // Validate items
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Transaction must have at least one item');
    }

    // Resolve products (snapshot names + stock deduction)
    const productIds = dto.items.map((i) => i.productId);
    // T21-fix: stock is per-branch; deduct from the warehouse's branch when given,
    // else the transaction branch (mirrors sales-transactions.service.ts branch filter)
    const stockBranchId = dto.warehouseId ?? dto.branchId;
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { productStocks: { where: { branchId: stockBranchId } } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of dto.items) {
      if (!productMap.has(item.productId)) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }
    }

    // Calculate totals
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice - (item.discountAmount || 0),
      0,
    );

    const discountValue =
      dto.discountAmount ||
      (dto.discountPercentage ? subtotal * (dto.discountPercentage / 100) : 0);

    const taxPercentage = dto.taxPercentage ?? 11;
    const subtotalAfterDiscount = subtotal - discountValue;
    const taxAmount = subtotalAfterDiscount * (taxPercentage / 100);
    const total = subtotalAfterDiscount + taxAmount;

    // Generate transaction number
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = randomBytes(3).toString('hex').toUpperCase();
    const transactionNumber = `TRX-${dateStr}-${seq}`;

    // T21: draft saves (status 'held') have no payment; completed otherwise
    const status = dto.status || (dto.payment ? 'completed' : 'pending');

    return this.prisma.$transaction(async (tx) => {
      // Create the transaction with items (snapshot real product name/sku)
      const transaction = await tx.salesTransaction.create({
        data: {
          transactionNumber,
          transactionType: 'pos',
          branchId: dto.branchId,
          customerId: dto.customerId || null,
          cashierId: userId,
          paymentTermId: dto.paymentTermId || null,
          salesPersonId: dto.salesPersonId || null,
          warehouseId: dto.warehouseId || null,
          salesTypeId: dto.salesTypeId || null,
          status,
          subtotal,
          discountAmount: discountValue,
          discountPercentage: dto.discountPercentage || null,
          taxAmount,
          taxPercentage,
          total,
          paymentStatus: dto.payment ? 'paid' : 'pending',
          receiptNotes: dto.receiptNotes || null,
          internalNotes: dto.internalNotes || dto.keterangan || null,
          items: {
            create: dto.items.map((item) => {
              const product = productMap.get(item.productId)!;
              const itemSubtotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
              return {
                productId: item.productId,
                productName: product.name,
                productSku: product.sku,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountAmount: item.discountAmount || 0,
                discountPercentage: null,
                subtotal: itemSubtotal,
              };
            }),
          },
        },
        include: {
          items: true,
          payments: true,
        },
      });

      // Deduct stock + create OUT/SALE movement (mirror sales-transactions.service.ts)
      for (const item of dto.items) {
        const product = productMap.get(item.productId)!;
        const stock = product.productStocks[0];
        if (!stock) {
          // Parity with sales-transactions.service.ts: never sell without a stock row
          throw new BadRequestException(
            `Product ${product.name} has no stock in branch ${stockBranchId}`,
          );
        }

        const quantityBefore = stock.quantityAvailable.toNumber();
        const quantityAfter = quantityBefore - item.quantity;

        await tx.productStock.update({
          where: { id: stock.id },
          data: {
            quantityAvailable: quantityAfter,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            branchId: stock.branchId, // actual row's branch, not dto.branchId
            movementType: 'OUT',
            referenceType: 'SALE',
            referenceId: transaction.id,
            quantityChange: -item.quantity,
            quantityBefore,
            quantityAfter,
            notes: `Sale: ${transaction.transactionNumber} - ${product.name} (${item.quantity} unit)`,
            createdBy: userId,
          },
        });
      }

      // Handle payment if provided
      if (dto.payment) {
        await tx.payment.create({
          data: {
            transactionId: transaction.id,
            paymentMethod: dto.payment.method,
            amount: dto.payment.amount,
            paymentDetails: dto.payment.details || undefined,
            status: 'completed',
            paidAt: new Date(),
          },
        });
      }

      return transaction;
    });
  }

  // ════════════════════════════════════════════
  // SUPPORTING LISTS
  // ════════════════════════════════════════════

  async searchProducts(query: string, limit: number = 20) {
    if (!query || query.length < 1) return [];

    return this.prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
          { barcode: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        sellingPrice: true,
        unitId: true,
      },
      take: limit,
      orderBy: { name: 'asc' },
    });
  }

  async searchCustomers(query: string, limit: number = 20) {
    if (!query || query.length < 1) return [];

    return this.prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
          { email: { contains: query, mode: 'insensitive' } },
          { customerCode: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        customerCode: true,
        name: true,
        phone: true,
        email: true,
      },
      take: limit,
      orderBy: { name: 'asc' },
    });
  }

  async listWarehouses() {
    return this.prisma.branch.findMany({
      where: { isWarehouse: true, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  async listSalesPersons() {
    // Users with sales-related roles
    const salesRoles = ['CSO', 'SPV', 'HS', 'SMO', 'CS'];
    return this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        userRoles: {
          some: {
            role: {
              code: { in: salesRoles },
            },
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        username: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  async listPaymentTerms() {
    return this.prisma.paymentTerm.findMany({
      where: { isActive: true },
      select: { id: true, name: true, days: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  async listSalesTypes() {
    return this.prisma.salesType.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }

  async listBranches() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }
}
