import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { RecordARPaymentDto } from '../dto/record-ar-payment.dto';
import { WriteOffARDto } from '../dto/write-off-ar.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { JournalEntriesService } from './journal-entries.service';

@Injectable()
export class AccountsReceivableService {
  constructor(
    private prisma: PrismaService,
    private journalEntriesService: JournalEntriesService,
  ) {}

  /**
   * Generate payment number: ARP-YYYYMMDD-XXXXXX
   */
  private generatePaymentNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `ARP-${dateStr}-${random}`;
  }

  /**
   * Generate write-off number: WO-YYYYMMDD-XXXXXX
   */
  private generateWriteOffNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `WO-${dateStr}-${random}`;
  }

  /**
   * Get AR aging report
   */
  async getAgingReport(asOfDate?: string) {
    const date = asOfDate ? new Date(asOfDate) : new Date();

    // Get all sales transactions that are not fully paid
    const transactions = await this.prisma.salesTransaction.findMany({
      where: {
        paymentStatus: { in: ['pending', 'partial'] },
        status: { in: ['completed'] },
      },
      include: {
        customer: true,
        payments: true,
      },
    });

    // Filter to only credit transactions (those with credit payments or pending payment)
    const creditTransactions = transactions.filter((txn) => {
      const hasCreditPayment = txn.payments.some(
        (p) => p.paymentMethod === 'credit',
      );
      return hasCreditPayment || txn.paymentStatus === 'pending';
    });

    // Calculate aging for each transaction
    const agingData = creditTransactions
      .map((txn) => {
        const totalAmount = txn.total.toNumber();
        const paidAmount = txn.payments.reduce(
          (sum: number, p: any) => sum + p.amount.toNumber(),
          0,
        );
        const outstanding = totalAmount - paidAmount;

        if (outstanding <= 0) {
          return null; // Skip fully paid
        }

        const daysOverdue = Math.floor(
          (date.getTime() - txn.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );

        let agingBucket: string;
        if (daysOverdue <= 30) {
          agingBucket = 'current';
        } else if (daysOverdue <= 60) {
          agingBucket = '31-60';
        } else if (daysOverdue <= 90) {
          agingBucket = '61-90';
        } else {
          agingBucket = '90+';
        }

        return {
          invoiceId: txn.id,
          invoiceNumber: txn.transactionNumber,
          customerId: txn.customerId,
          customerName: txn.customer?.name || 'Unknown',
          invoiceDate: txn.createdAt,
          totalAmount,
          paidAmount,
          outstanding,
          daysOverdue,
          agingBucket,
        };
      })
      .filter((item) => item !== null);

    // Group by customer and aging bucket
    const summary = agingData.reduce((acc: any, item: any) => {
      if (!acc[item.customerId]) {
        acc[item.customerId] = {
          customerId: item.customerId,
          customerName: item.customerName,
          current: 0,
          '31-60': 0,
          '61-90': 0,
          '90+': 0,
          total: 0,
        };
      }

      acc[item.customerId][item.agingBucket] += item.outstanding;
      acc[item.customerId].total += item.outstanding;

      return acc;
    }, {});

    return {
      asOfDate: date.toISOString(),
      details: agingData,
      summary: Object.values(summary),
      totals: {
        current: agingData
          .filter((item: any) => item.agingBucket === 'current')
          .reduce((sum: number, item: any) => sum + item.outstanding, 0),
        '31-60': agingData
          .filter((item: any) => item.agingBucket === '31-60')
          .reduce((sum: number, item: any) => sum + item.outstanding, 0),
        '61-90': agingData
          .filter((item: any) => item.agingBucket === '61-90')
          .reduce((sum: number, item: any) => sum + item.outstanding, 0),
        '90+': agingData
          .filter((item: any) => item.agingBucket === '90+')
          .reduce((sum: number, item: any) => sum + item.outstanding, 0),
      },
    };
  }

  /**
   * Get customer AR detail
   */
  async getCustomerAR(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    const transactions = await this.prisma.salesTransaction.findMany({
      where: {
        customerId,
        paymentStatus: { in: ['pending', 'partial'] },
        status: { in: ['completed'] },
      },
      include: {
        payments: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Filter to only credit transactions (those with credit payments or pending payment)
    const creditTransactions = transactions.filter((txn) => {
      const hasCreditPayment = txn.payments.some(
        (p) => p.paymentMethod === 'credit',
      );
      return hasCreditPayment || txn.paymentStatus === 'pending';
    });

    const arDetails = creditTransactions.map((txn) => {
      const totalAmount = txn.total.toNumber();
      const paidAmount = txn.payments.reduce(
        (sum: number, p: any) => sum + p.amount.toNumber(),
        0,
      );
      const outstanding = totalAmount - paidAmount;

      return {
        invoiceId: txn.id,
        invoiceNumber: txn.transactionNumber,
        invoiceDate: txn.createdAt,
        totalAmount,
        paidAmount,
        outstanding,
        daysOverdue: Math.floor(
          (new Date().getTime() - txn.createdAt.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      };
    });

    const totalOutstanding = arDetails.reduce(
      (sum, item) => sum + item.outstanding,
      0,
    );

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        customerCode: customer.customerCode,
      },
      invoices: arDetails,
      totalOutstanding,
    };
  }

  /**
   * Record AR payment
   */
  async recordPayment(
    invoiceId: string,
    dto: RecordARPaymentDto,
    userId: string,
  ) {
    const invoice = await this.prisma.salesTransaction.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Check if invoice has credit payment (AR only applies to credit transactions)
    const hasCreditPayment = invoice.payments.some(
      (p) => p.paymentMethod === 'credit',
    );
    if (!hasCreditPayment && invoice.paymentStatus !== 'pending') {
      throw new BadRequestException('Invoice is not a credit transaction');
    }

    const totalAmount = invoice.total.toNumber();
    const paidAmount = invoice.payments.reduce(
      (sum, p) => sum + p.amount.toNumber(),
      0,
    );
    const outstanding = totalAmount - paidAmount;

    if (dto.amount > outstanding) {
      throw new BadRequestException(
        `Payment amount (${dto.amount}) exceeds outstanding balance (${outstanding})`,
      );
    }

    // Determine payment account
    let paymentAccountId = dto.bank_account_id;
    if (dto.payment_method === 'cash') {
      // Find cash account
      const cashAccount = await this.prisma.chartOfAccount.findFirst({
        where: {
          code: { startsWith: '1010' },
          isHeader: false,
          isActive: true,
        },
      });
      if (cashAccount) {
        paymentAccountId = cashAccount.id;
      }
    }

    if (!paymentAccountId) {
      throw new BadRequestException('Payment account is required');
    }

    // Find AR account (10300)
    const arAccount = await this.prisma.chartOfAccount.findUnique({
      where: { code: '10300' },
    });

    if (!arAccount) {
      throw new NotFoundException('Accounts Receivable account not found');
    }

    // Generate payment number
    const paymentNumber = this.generatePaymentNumber();

    // Create payment record
    const payment = await this.prisma.aRPayment.create({
      data: {
        invoiceId,
        customerId: invoice.customerId!,
        paymentNumber,
        paymentDate: dto.payment_date ? new Date(dto.payment_date) : new Date(),
        amount: new Decimal(dto.amount),
        paymentMethod: dto.payment_method,
        bankAccountId: paymentAccountId,
        referenceNumber: dto.reference_number,
        notes: dto.notes,
        recordedBy: userId,
      },
    });

    // Create journal entry
    const journalEntry = await this.journalEntriesService.create(
      {
        entry_date: dto.payment_date || new Date().toISOString(),
        entry_type: 'auto',
        description: `AR Payment ${paymentNumber} for invoice ${invoice.transactionNumber}`,
        reference_type: 'ar_payment',
        reference_id: payment.id,
        notes: dto.notes,
        lines: [
          {
            account_id: paymentAccountId,
            debit_amount: dto.amount,
            credit_amount: 0,
            line_description: `Payment from ${invoice.customer?.name || 'Customer'}`,
          },
          {
            account_id: arAccount.id,
            debit_amount: 0,
            credit_amount: dto.amount,
            line_description: `AR Payment for invoice ${invoice.transactionNumber}`,
          },
        ],
      },
      userId,
    );

    // Post journal entry
    await this.journalEntriesService.post(journalEntry.id, userId);

    // Update payment with journal entry ID
    await this.prisma.aRPayment.update({
      where: { id: payment.id },
      data: { journalEntryId: journalEntry.id },
    });

    // Update invoice status if fully paid
    const newPaidAmount = paidAmount + dto.amount;
    if (newPaidAmount >= totalAmount) {
      await this.prisma.salesTransaction.update({
        where: { id: invoiceId },
        data: { status: 'paid' },
      });
    } else {
      await this.prisma.salesTransaction.update({
        where: { id: invoiceId },
        data: { status: 'paid_partial' },
      });
    }

    // Update customer credit used
    await this.prisma.customer.update({
      where: { id: invoice.customerId! },
      data: {
        creditUsed: {
          decrement: new Decimal(dto.amount),
        },
      },
    });

    return {
      payment,
      journalEntry,
      newOutstanding: outstanding - dto.amount,
    };
  }

  /**
   * Write off bad debt
   */
  async writeOff(invoiceId: string, dto: WriteOffARDto, userId: string) {
    const invoice = await this.prisma.salesTransaction.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        payments: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Check if invoice has credit payment (AR only applies to credit transactions)
    const hasCreditPayment = invoice.payments.some(
      (p) => p.paymentMethod === 'credit',
    );
    if (!hasCreditPayment && invoice.paymentStatus !== 'pending') {
      throw new BadRequestException('Invoice is not a credit transaction');
    }

    const totalAmount = invoice.total.toNumber();
    const paidAmount = invoice.payments.reduce(
      (sum, p) => sum + p.amount.toNumber(),
      0,
    );
    const outstanding = totalAmount - paidAmount;

    if (outstanding <= 0) {
      throw new BadRequestException('No outstanding amount to write off');
    }

    // Find AR account and Bad Debt Expense account
    const arAccount = await this.prisma.chartOfAccount.findUnique({
      where: { code: '10300' },
    });

    if (!arAccount) {
      throw new NotFoundException('Accounts Receivable account not found');
    }

    // Find or create Bad Debt Expense account (52000 or create if doesn't exist)
    let badDebtAccount = await this.prisma.chartOfAccount.findUnique({
      where: { code: '52000' },
    });

    if (!badDebtAccount) {
      // Create Bad Debt Expense account if it doesn't exist
      badDebtAccount = await this.prisma.chartOfAccount.create({
        data: {
          code: '52000',
          name: 'Bad Debt Expense',
          accountType: 'EXPENSE',
          isHeader: false,
          isActive: true,
        },
      });
    }

    // Generate write-off number
    const writeOffNumber = this.generateWriteOffNumber();

    // Create write-off record
    const writeOff = await this.prisma.writeOff.create({
      data: {
        invoiceId,
        customerId: invoice.customerId!,
        writeOffNumber,
        writeOffDate: dto.write_off_date ? new Date(dto.write_off_date) : new Date(),
        amount: new Decimal(outstanding),
        reason: dto.reason,
        approvedBy: userId,
      },
    });

    // Create journal entry
    const journalEntry = await this.journalEntriesService.create(
      {
        entry_date: dto.write_off_date || new Date().toISOString(),
        entry_type: 'manual',
        description: `Write-off ${writeOffNumber} for invoice ${invoice.transactionNumber}: ${dto.reason}`,
        reference_type: 'write_off',
        reference_id: writeOff.id,
        notes: dto.reason,
        lines: [
          {
            account_id: badDebtAccount.id,
            debit_amount: outstanding,
            credit_amount: 0,
            line_description: `Bad debt write-off for ${invoice.customer?.name || 'Customer'}`,
          },
          {
            account_id: arAccount.id,
            debit_amount: 0,
            credit_amount: outstanding,
            line_description: `Write-off invoice ${invoice.transactionNumber}`,
          },
        ],
      },
      userId,
    );

    // Post journal entry
    await this.journalEntriesService.post(journalEntry.id, userId);

    // Update write-off with journal entry ID
    await this.prisma.writeOff.update({
      where: { id: writeOff.id },
      data: { journalEntryId: journalEntry.id },
    });

    // Update invoice status
    await this.prisma.salesTransaction.update({
      where: { id: invoiceId },
      data: { status: 'written_off' },
    });

    // Update customer credit used
    await this.prisma.customer.update({
      where: { id: invoice.customerId! },
      data: {
        creditUsed: {
          decrement: new Decimal(outstanding),
        },
      },
    });

    return {
      writeOff,
      journalEntry,
    };
  }
}

