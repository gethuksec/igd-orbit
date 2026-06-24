import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateCustomerDepositDto } from './dto';

/**
 * Customer Deposits Service
 * Handles customer deposit operations (return credits, deposit payments)
 */
@Injectable()
export class CustomerDepositsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a deposit entry (add to customer balance)
   * Used when a return is credited as deposit instead of cash refund
   */
  async createReturnDeposit(dto: CreateCustomerDepositDto): Promise<any> {
    if (dto.type !== 'return_credit') {
      throw new BadRequestException('Type must be return_credit for this operation');
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return this.prisma.$transaction(async (tx) => {
      // Create deposit record
      const deposit = await tx.customerDeposit.create({
        data: {
          customerId: dto.customerId,
          amount: dto.amount,
          type: dto.type,
          referenceId: dto.referenceId || null,
          notes: dto.notes || null,
        },
      });

      // Update customer deposit balance
      await tx.customer.update({
        where: { id: dto.customerId },
        data: {
          depositBalance: {
            increment: dto.amount,
          },
        },
      });

      return deposit;
    });
  }

  /**
   * Use deposit balance during checkout
   * Deducts from customer balance and creates a deposit record
   */
  async useDeposit(
    customerId: string,
    amount: number,
    referenceTransactionId?: string,
  ): Promise<any> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const currentBalance = customer.depositBalance
      ? customer.depositBalance.toNumber()
      : 0;

    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (amount > currentBalance) {
      throw new BadRequestException(
        `Insufficient deposit balance. Available: ${currentBalance}, Requested: ${amount}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Create deposit record (negative amount = deduction)
      const deposit = await tx.customerDeposit.create({
        data: {
          customerId,
          amount: -amount, // negative for deduction
          type: 'payment_used',
          referenceId: referenceTransactionId || null,
          notes: `Deposit used for transaction ${referenceTransactionId || 'N/A'}`,
        },
      });

      // Update customer deposit balance
      await tx.customer.update({
        where: { id: customerId },
        data: {
          depositBalance: {
            decrement: amount,
          },
        },
      });

      return deposit;
    });
  }

  /**
   * Get customer deposit balance
   */
  async getDepositBalance(customerId: string): Promise<number> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { depositBalance: true },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer.depositBalance ? customer.depositBalance.toNumber() : 0;
  }

  /**
   * Get deposit transaction history for a customer
   */
  async getDepositHistory(customerId: string): Promise<any[]> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const deposits = await this.prisma.customerDeposit.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return deposits.map((d) => ({
      id: d.id,
      amount: d.amount.toNumber(),
      type: d.type,
      referenceId: d.referenceId,
      notes: d.notes,
      createdAt: d.createdAt,
    }));
  }

  /**
   * Refund a deposit (reverse a previous deposit)
   */
  async refundDeposit(
    customerId: string,
    amount: number,
    notes?: string,
  ): Promise<any> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const currentBalance = customer.depositBalance
      ? customer.depositBalance.toNumber()
      : 0;

    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    if (amount > currentBalance) {
      throw new BadRequestException(
        `Insufficient deposit balance. Available: ${currentBalance}, Requested: ${amount}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deposit = await tx.customerDeposit.create({
        data: {
          customerId,
          amount: -amount,
          type: 'refund',
          notes: notes || 'Deposit refunded to customer',
        },
      });

      await tx.customer.update({
        where: { id: customerId },
        data: {
          depositBalance: {
            decrement: amount,
          },
        },
      });

      return deposit;
    });
  }
}
