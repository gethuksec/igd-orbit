import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CreateJournalEntryDto, JournalLineDto } from '../dto/create-journal-entry.dto';
import { UpdateJournalEntryDto } from '../dto/update-journal-entry.dto';
import { ReverseJournalEntryDto } from '../dto/reverse-journal-entry.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class JournalEntriesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate journal entry number: JE-YYYYMMDD-XXXXXX
   */
  private generateEntryNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `JE-${dateStr}-${random}`;
  }

  /**
   * Validate journal entry lines
   */
  private validateJournalLines(lines: JournalLineDto[]): void {
    if (lines.length < 2) {
      throw new BadRequestException('Journal entry must have at least 2 lines');
    }

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const line of lines) {
      // Each line must have either debit OR credit (not both, not neither)
      if (line.debit_amount > 0 && line.credit_amount > 0) {
        throw new BadRequestException(
          'Each line must have either debit OR credit, not both',
        );
      }

      if (line.debit_amount === 0 && line.credit_amount === 0) {
        throw new BadRequestException('Each line must have either debit or credit amount');
      }

      totalDebit = totalDebit.plus(line.debit_amount);
      totalCredit = totalCredit.plus(line.credit_amount);
    }

    // Total debits must equal total credits
    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Journal entry is not balanced. Debits: ${totalDebit}, Credits: ${totalCredit}`,
      );
    }
  }

  /**
   * Validate all accounts exist and are active
   */
  private async validateAccounts(lines: JournalLineDto[]): Promise<void> {
    const accountIds = lines.map((line) => line.account_id);
    const accounts = await this.prisma.chartOfAccount.findMany({
      where: {
        id: { in: accountIds },
        isActive: true,
      },
    });

    if (accounts.length !== accountIds.length) {
      throw new NotFoundException('One or more accounts not found or inactive');
    }

    // Check for header accounts (cannot have transactions)
    const headerAccounts = accounts.filter((acc) => acc.isHeader);
    if (headerAccounts.length > 0) {
      throw new BadRequestException(
        `Cannot use header accounts in journal entries: ${headerAccounts.map((a) => a.code).join(', ')}`,
      );
    }
  }

  /**
   * Create journal entry
   */
  async create(dto: CreateJournalEntryDto, userId: string) {
    // Validate lines
    this.validateJournalLines(dto.lines);
    await this.validateAccounts(dto.lines);

    // Generate entry number if not provided
    const entryNumber = dto.entry_number || this.generateEntryNumber();

    // Check if entry number already exists
    const existing = await this.prisma.journalEntry.findUnique({
      where: { entryNumber },
    });

    if (existing) {
      throw new BadRequestException('Entry number already exists');
    }

    // Create journal entry with lines
    const entry = await this.prisma.journalEntry.create({
      data: {
        entryNumber,
        entryDate: new Date(dto.entry_date),
        entryType: dto.entry_type,
        description: dto.description,
        referenceType: dto.reference_type,
        referenceId: dto.reference_id,
        notes: dto.notes,
        status: 'draft',
        createdBy: userId,
        lines: {
          create: dto.lines.map((line) => ({
            accountId: line.account_id,
            debitAmount: new Decimal(line.debit_amount),
            creditAmount: new Decimal(line.credit_amount),
            lineDescription: line.line_description,
            branchId: line.branch_id,
            departmentId: line.department_id,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: true,
            branch: true,
            department: true,
          },
        },
      },
    });

    return entry;
  }

  /**
   * Find all journal entries with filters
   */
  async findAll(query: {
    startDate?: string;
    endDate?: string;
    status?: string;
    entryType?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.startDate || query.endDate) {
      where.entryDate = {};
      if (query.startDate) {
        where.entryDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.entryDate.lte = new Date(query.endDate);
      }
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.entryType) {
      where.entryType = query.entryType;
    }

    const [entries, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
        orderBy: { entryDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    return {
      data: entries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find journal entry by ID
   */
  async findById(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: true,
            branch: true,
            department: true,
          },
        },
        originalEntry: true,
        reversalEntry: true,
      },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    return entry;
  }

  /**
   * Update journal entry (only if draft)
   */
  async update(id: string, dto: UpdateJournalEntryDto, _userId: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status !== 'draft') {
      throw new BadRequestException('Can only update draft entries');
    }

    // If lines are being updated, validate them
    if (dto.lines) {
      this.validateJournalLines(dto.lines);
      await this.validateAccounts(dto.lines);

      // Delete existing lines and create new ones
      await this.prisma.journalEntryLine.deleteMany({
        where: { journalEntryId: id },
      });
    }

    const updateData: any = {};

    if (dto.entry_date) {
      updateData.entryDate = new Date(dto.entry_date);
    }

    if (dto.description) {
      updateData.description = dto.description;
    }

    if (dto.notes !== undefined) {
      updateData.notes = dto.notes;
    }

    const updated = await this.prisma.journalEntry.update({
      where: { id },
      data: {
        ...updateData,
        ...(dto.lines && {
          lines: {
            create: dto.lines.map((line) => ({
              accountId: line.account_id,
              debitAmount: new Decimal(line.debit_amount),
              creditAmount: new Decimal(line.credit_amount),
              lineDescription: line.line_description,
              branchId: line.branch_id,
              departmentId: line.department_id,
            })),
          },
        }),
      },
      include: {
        lines: {
          include: {
            account: true,
            branch: true,
            department: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Delete journal entry (only if draft)
   */
  async delete(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status !== 'draft') {
      throw new BadRequestException('Can only delete draft entries');
    }

    await this.prisma.journalEntry.delete({
      where: { id },
    });

    return { message: 'Journal entry deleted successfully' };
  }

  /**
   * Post journal entry to ledger
   */
  async post(entryId: string, userId: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: {
        lines: true,
      },
    });

    if (!entry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (entry.status !== 'draft') {
      throw new BadRequestException('Can only post draft entries');
    }

    // Validate entry is balanced
    this.validateJournalLines(
      entry.lines.map((line) => ({
        account_id: line.accountId,
        debit_amount: line.debitAmount.toNumber(),
        credit_amount: line.creditAmount.toNumber(),
        line_description: line.lineDescription || undefined,
        branch_id: line.branchId || undefined,
        department_id: line.departmentId || undefined,
      })),
    );

    // Update status to posted
    const posted = await this.prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        status: 'posted',
        postedAt: new Date(),
        postedBy: userId,
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    return posted;
  }

  /**
   * Reverse journal entry
   */
  async reverse(entryId: string, dto: ReverseJournalEntryDto, userId: string) {
    const originalEntry = await this.prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: {
        lines: true,
      },
    });

    if (!originalEntry) {
      throw new NotFoundException('Journal entry not found');
    }

    if (originalEntry.status !== 'posted') {
      throw new BadRequestException('Can only reverse posted entries');
    }

    if (originalEntry.originalEntryId) {
      throw new BadRequestException('Cannot reverse a reversal entry');
    }

    // Create reversal entry (flip debit/credit)
    const reversalEntryNumber = this.generateEntryNumber();
    const reversalEntry = await this.prisma.journalEntry.create({
      data: {
        entryNumber: reversalEntryNumber,
        entryDate: new Date(),
        entryType: 'manual',
        description: `Reversal of ${originalEntry.entryNumber}: ${dto.reason}`,
        notes: dto.notes,
        status: 'posted', // Auto-post reversal
        postedAt: new Date(),
        postedBy: userId,
        originalEntryId: entryId,
        createdBy: userId,
        reversalReason: dto.reason,
        lines: {
          create: originalEntry.lines.map((line) => ({
            accountId: line.accountId,
            debitAmount: line.creditAmount, // Flip
            creditAmount: line.debitAmount, // Flip
            lineDescription: `Reversal: ${line.lineDescription || ''}`,
            branchId: line.branchId,
            departmentId: line.departmentId,
          })),
        },
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    // Update original entry status
    await this.prisma.journalEntry.update({
      where: { id: entryId },
      data: {
        status: 'reversed',
        reversedAt: new Date(),
        reversedBy: userId,
        reversalReason: dto.reason,
      },
    });

    return reversalEntry;
  }

  /**
   * Auto-generate journal entry from transaction
   */
  async autoGenerateFromTransaction(
    transactionType: string,
    _transactionId: string,
  ) {
    // This will be implemented based on transaction type
    // For now, return placeholder
    throw new BadRequestException(
      `Auto-generation for ${transactionType} not yet implemented`,
    );
  }
}

