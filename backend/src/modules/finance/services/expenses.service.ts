import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { ApproveExpenseDto } from '../dto/approve-expense.dto';
import { RejectExpenseDto } from '../dto/reject-expense.dto';
import { PayExpenseDto } from '../dto/pay-expense.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { JournalEntriesService } from './journal-entries.service';

@Injectable()
export class ExpensesService {
  constructor(
    private prisma: PrismaService,
    private journalEntriesService: JournalEntriesService,
  ) {}

  /**
   * Generate expense number: EXP-YYYYMMDD-XXXXXX
   */
  private generateExpenseNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `EXP-${dateStr}-${random}`;
  }

  /**
   * Determine required approver based on amount
   */
  private getRequiredApprover(amount: number): string[] {
    if (amount < 500000) {
      return ['HS']; // Auto-approved or HS
    } else if (amount < 2000000) {
      return ['HS', 'SPV']; // HS or SPV
    } else if (amount < 10000000) {
      return ['SPV', 'CFO']; // SPV or CFO
    } else {
      return ['CFO']; // CFO + Owner notification
    }
  }

  /**
   * Create expense
   */
  async createExpense(dto: CreateExpenseDto, userId: string) {
    // Validate GL account exists and is expense type
    const glAccount = await this.prisma.chartOfAccount.findUnique({
      where: { id: dto.gl_account_id },
    });

    if (!glAccount) {
      throw new NotFoundException('GL account not found');
    }

    if (glAccount.accountType !== 'EXPENSE') {
      throw new BadRequestException('GL account must be an expense account');
    }

    if (glAccount.isHeader) {
      throw new BadRequestException('Cannot use header account');
    }

    // Calculate total amount
    const amount = new Decimal(dto.amount);
    const taxAmount = new Decimal(dto.tax_amount || 0);
    const totalAmount = amount.plus(taxAmount);

    // Generate expense number
    const expenseNumber = this.generateExpenseNumber();

    // Approval workflow determined in approveExpense method

    // Create expense
    const expense = await this.prisma.expense.create({
      data: {
        expenseNumber,
        expenseCategory: dto.expense_category,
        expenseDate: new Date(dto.expense_date),
        amount,
        taxAmount,
        totalAmount,
        paymentMethod: dto.payment_method,
        bankAccountId: dto.bank_account_id,
        branchId: dto.branch_id,
        departmentId: dto.department_id,
        glAccountId: dto.gl_account_id,
        description: dto.description,
        receiptUrl: dto.receipt_url,
        notes: dto.notes,
        status: 'pending',
        requestedBy: userId,
      },
      include: {
        glAccount: true,
        branch: true,
        department: true,
      },
    });

    return expense;
  }

  /**
   * List expenses with filters
   */
  async findAll(query: {
    startDate?: string;
    endDate?: string;
    status?: string;
    branchId?: string;
    departmentId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.startDate || query.endDate) {
      where.expenseDate = {};
      if (query.startDate) {
        where.expenseDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.expenseDate.lte = new Date(query.endDate);
      }
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    const [expenses, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: {
          glAccount: true,
          branch: true,
          department: true,
        },
        orderBy: { expenseDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      data: expenses,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get expense by ID
   */
  async findById(id: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: {
        glAccount: true,
        branch: true,
        department: true,
        journalEntry: true,
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return expense;
  }

  /**
   * Update expense (only if pending)
   */
  async update(id: string, dto: Partial<CreateExpenseDto>, _userId: string) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (expense.status !== 'pending') {
      throw new BadRequestException('Can only update pending expenses');
    }

    const updateData: any = {};

    if (dto.expense_date) {
      updateData.expenseDate = new Date(dto.expense_date);
    }

    if (dto.amount !== undefined) {
      updateData.amount = new Decimal(dto.amount);
      const taxAmount = new Decimal(dto.tax_amount || 0);
      updateData.totalAmount = updateData.amount.plus(taxAmount);
    }

    if (dto.tax_amount !== undefined) {
      updateData.taxAmount = new Decimal(dto.tax_amount);
      const amount = new Decimal(dto.amount || expense.amount);
      updateData.totalAmount = amount.plus(updateData.taxAmount);
    }

    if (dto.description) {
      updateData.description = dto.description;
    }

    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    if (dto.receipt_url !== undefined) {
      updateData.receiptUrl = dto.receipt_url;
    }

    return this.prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        glAccount: true,
        branch: true,
        department: true,
      },
    });
  }

  /**
   * Approve expense
   */
  async approveExpense(
    expenseId: string,
    dto: ApproveExpenseDto,
    userId: string,
    userRoles: string[],
  ) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (expense.status !== 'pending') {
      throw new BadRequestException('Can only approve pending expenses');
    }

    // Check user has approval authority
    const requiredApprovers = this.getRequiredApprover(
      expense.totalAmount.toNumber(),
    );
    const hasAuthority = requiredApprovers.some((role) =>
      userRoles.includes(role),
    );

    if (!hasAuthority) {
      throw new ForbiddenException(
        'You do not have authority to approve this expense',
      );
    }

    // Update status
    const approved = await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        notes: dto.notes ? `${expense.notes || ''}\nApproval: ${dto.notes}`.trim() : expense.notes,
      },
      include: {
        glAccount: true,
        branch: true,
        department: true,
      },
    });

    return approved;
  }

  /**
   * Reject expense
   */
  async rejectExpense(
    expenseId: string,
    dto: RejectExpenseDto,
    userId: string,
    userRoles: string[],
  ) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (expense.status !== 'pending') {
      throw new BadRequestException('Can only reject pending expenses');
    }

    // Check user has approval authority
    const requiredApprovers = this.getRequiredApprover(
      expense.totalAmount.toNumber(),
    );
    const hasAuthority = requiredApprovers.some((role) =>
      userRoles.includes(role),
    );

    if (!hasAuthority) {
      throw new ForbiddenException(
        'You do not have authority to reject this expense',
      );
    }

    const rejected = await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: 'rejected',
        rejectedBy: userId,
        rejectedAt: new Date(),
        rejectionReason: dto.reason,
      },
      include: {
        glAccount: true,
        branch: true,
        department: true,
      },
    });

    return rejected;
  }

  /**
   * Pay expense (create journal entry)
   */
  async payExpense(
    expenseId: string,
    dto: PayExpenseDto,
    userId: string,
  ) {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        glAccount: true,
      },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (expense.status !== 'approved') {
      throw new BadRequestException('Can only pay approved expenses');
    }

    // Determine payment account (cash or bank)
    let paymentAccountId = expense.bankAccountId;
    if (dto.payment_method === 'cash') {
      // Find cash account (10101 or 10102 based on branch)
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
    } else if (dto.bank_account_id) {
      paymentAccountId = dto.bank_account_id;
    }

    if (!paymentAccountId) {
      throw new BadRequestException('Payment account is required');
    }

    // Create journal entry
    const journalEntry = await this.journalEntriesService.create(
      {
        entry_date: dto.payment_date || new Date().toISOString(),
        entry_type: 'auto',
        description: `Payment for expense ${expense.expenseNumber}`,
        reference_type: 'expense',
        reference_id: expenseId,
        notes: dto.notes,
        lines: [
          {
            account_id: expense.glAccountId,
            debit_amount: expense.totalAmount.toNumber(),
            credit_amount: 0,
            line_description: expense.description,
            branch_id: expense.branchId || undefined,
            department_id: expense.departmentId || undefined,
          },
          {
            account_id: paymentAccountId,
            debit_amount: 0,
            credit_amount: expense.totalAmount.toNumber(),
            line_description: `Payment via ${dto.payment_method}`,
            branch_id: expense.branchId || undefined,
          },
        ],
      },
      userId,
    );

    // Post journal entry
    await this.journalEntriesService.post(journalEntry.id, userId);

    // Update expense status
    const paid = await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        status: 'paid',
        paidAt: new Date(),
        paidBy: userId,
        journalEntryId: journalEntry.id,
      },
      include: {
        glAccount: true,
        branch: true,
        department: true,
        journalEntry: true,
      },
    });

    return paid;
  }
}

