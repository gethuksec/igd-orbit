import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreatePettyCashFundDto } from '../dto/create-petty-cash-fund.dto';
import { RecordPettyCashTransactionDto } from '../dto/record-petty-cash-transaction.dto';
import { ReconcilePettyCashDto } from '../dto/reconcile-petty-cash.dto';
import { Decimal } from '@prisma/client/runtime/library';
@Injectable()
export class PettyCashService {
  constructor(
    private prisma: PrismaService,
  ) {}

  /**
   * Generate fund number: PC-{BRANCH}-{YYYY}{MM}
   */
  private generateFundNumber(branchCode: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `PC-${branchCode}-${year}${month}`;
  }

  /**
   * Generate transaction number: PCT-YYYYMMDD-XXXXXX
   */
  private generateTransactionNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `PCT-${dateStr}-${random}`;
  }

  /**
   * Create petty cash fund
   */
  async createFund(dto: CreatePettyCashFundDto, _userId: string) {
    // Get branch
    const branch = await this.prisma.branch.findUnique({
      where: { id: dto.branch_id },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Check if active fund exists
    const existingFund = await this.prisma.pettyCash.findFirst({
      where: {
        branchId: dto.branch_id,
        isActive: true,
      },
    });

    if (existingFund) {
      throw new BadRequestException('Active petty cash fund already exists for this branch');
    }

    // Generate fund number
    const fundNumber = dto.fund_number || this.generateFundNumber(branch.code);

    // Create fund
    const fund = await this.prisma.pettyCash.create({
      data: {
        fundNumber,
        branchId: dto.branch_id,
        custodianId: dto.custodian_id,
        openingBalance: new Decimal(dto.opening_balance),
        currentBalance: new Decimal(dto.opening_balance),
        periodStart: new Date(dto.period_start),
        periodEnd: dto.period_end ? new Date(dto.period_end) : null,
      },
      include: {
        branch: true,
      },
    });

    // Create initial journal entry (DR: Petty Cash, CR: Bank)
    // This would typically debit from a bank account
    // For now, we'll create a placeholder entry
    // In production, you'd specify which bank account to credit

    return fund;
  }

  /**
   * List petty cash funds
   */
  async findAll(query: { branchId?: string; isActive?: boolean }) {
    const where: any = {};

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    return this.prisma.pettyCash.findMany({
      where,
      include: {
        branch: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get fund by ID
   */
  async findById(id: string) {
    const fund = await this.prisma.pettyCash.findUnique({
      where: { id },
      include: {
        branch: true,
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!fund) {
      throw new NotFoundException('Petty cash fund not found');
    }

    return fund;
  }

  /**
   * Record petty cash transaction
   */
  async recordTransaction(
    fundId: string,
    dto: RecordPettyCashTransactionDto,
    userId: string,
  ) {
    const fund = await this.prisma.pettyCash.findUnique({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException('Petty cash fund not found');
    }

    if (!fund.isActive) {
      throw new BadRequestException('Fund is not active');
    }

    // Check if user is custodian or authorized
    // For now, allow any authenticated user (can be enhanced with role check)

    const amount = new Decimal(dto.amount);
    let newBalance: Decimal;

    if (dto.transaction_type === 'disbursement') {
      // Check sufficient balance
      if (fund.currentBalance.lessThan(amount)) {
        throw new BadRequestException('Insufficient petty cash balance');
      }
      newBalance = fund.currentBalance.minus(amount);
    } else {
      // Replenishment
      newBalance = fund.currentBalance.plus(amount);
    }

    // Generate transaction number
    const transactionNumber = this.generateTransactionNumber();

    // Create transaction
    const transaction = await this.prisma.pettyCashTransaction.create({
      data: {
        pettyCashId: fundId,
        transactionNumber,
        transactionType: dto.transaction_type,
        amount,
        category: dto.category,
        description: dto.description,
        receiptUrl: dto.receipt_url,
        balanceBefore: fund.currentBalance,
        balanceAfter: newBalance,
        recordedBy: userId,
        status: 'approved', // Auto-approve for now (can add approval workflow)
        approvedBy: userId,
        approvedAt: new Date(),
      },
    });

    // Update fund balance
    await this.prisma.pettyCash.update({
      where: { id: fundId },
      data: {
        currentBalance: newBalance,
      },
    });

    return transaction;
  }

  /**
   * Reconcile petty cash fund
   */
  async reconcileFund(
    fundId: string,
    dto: ReconcilePettyCashDto,
    userId: string,
  ) {
    const fund = await this.prisma.pettyCash.findUnique({
      where: { id: fundId },
    });

    if (!fund) {
      throw new NotFoundException('Petty cash fund not found');
    }

    const physicalCount = new Decimal(dto.physical_count);
    const systemBalance = fund.currentBalance;
    const variance = physicalCount.minus(systemBalance);

    // If there's a variance, require explanation
    if (!variance.equals(0) && !dto.variance_explanation) {
      throw new BadRequestException(
        'Variance explanation is required when there is a discrepancy',
      );
    }

    // Close current period
    await this.prisma.pettyCash.update({
      where: { id: fundId },
      data: {
        periodEnd: new Date(),
        isActive: false,
        currentBalance: physicalCount, // Update to physical count
      },
    });

    // If variance exists, create adjustment entry
    if (!variance.equals(0)) {
      // Create adjustment journal entry
      // This would be implemented based on your accounting rules
      // For now, just return the reconciliation result
    }

    return {
      fundId,
      systemBalance: systemBalance.toNumber(),
      physicalCount: physicalCount.toNumber(),
      variance: variance.toNumber(),
      varianceExplanation: dto.variance_explanation,
      reconciledAt: new Date(),
      reconciledBy: userId,
    };
  }
}

