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

  async createTransaction(dto: CreatePosTransactionDto) {
    // Validate items
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Transaction must have at least one item');
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

    // Create the transaction with items
    const transaction = await this.prisma.salesTransaction.create({
      data: {
        transactionNumber,
        transactionType: 'pos',
        branchId: dto.branchId,
        customerId: dto.customerId || null,
        cashierId: dto.salesPersonId || 'system', // fallback
        paymentTermId: dto.paymentTermId || null,
        salesPersonId: dto.salesPersonId || null,
        warehouseId: dto.warehouseId || null,
        status: dto.payment ? 'completed' : 'pending',
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
            const itemSubtotal = item.quantity * item.unitPrice - (item.discountAmount || 0);
            return {
              productId: item.productId,
              productName: '', // Will be populated
              productSku: '',  // Will be populated
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: item.discountAmount || 0,
              discountPercentage: null,
              subtotal: itemSubtotal,
              cashback: item.cashback || 0,
            };
          }),
        },
      },
      include: {
        items: true,
        payments: true,
      },
    });

    // Handle payment if provided
    if (dto.payment) {
      await this.prisma.payment.create({
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
