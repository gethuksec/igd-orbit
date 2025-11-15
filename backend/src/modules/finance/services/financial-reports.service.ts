import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { AccountsReceivableService } from './accounts-receivable.service';

@Injectable()
export class FinancialReportsService {
  constructor(
    private prisma: PrismaService,
    private arService: AccountsReceivableService,
  ) {}

  /**
   * Get Trial Balance
   */
  async getTrialBalance(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get all posted journal entries in date range
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        status: 'posted',
        entryDate: {
          gte: start,
          lte: end,
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

    // Aggregate by account
    const accountBalances: Record<
      string,
      {
        accountId: string;
        accountCode: string;
        accountName: string;
        accountType: string;
        totalDebit: Decimal;
        totalCredit: Decimal;
        balance: Decimal;
      }
    > = {};

    for (const entry of entries) {
      for (const line of entry.lines) {
        const accountId = line.accountId;
        if (!accountBalances[accountId]) {
          accountBalances[accountId] = {
            accountId,
            accountCode: line.account.code,
            accountName: line.account.name,
            accountType: line.account.accountType,
            totalDebit: new Decimal(0),
            totalCredit: new Decimal(0),
            balance: new Decimal(0),
          };
        }

        accountBalances[accountId].totalDebit = accountBalances[
          accountId
        ].totalDebit.plus(line.debitAmount);
        accountBalances[accountId].totalCredit = accountBalances[
          accountId
        ].totalCredit.plus(line.creditAmount);
      }
    }

    // Calculate balances
    const accounts = Object.values(accountBalances).map((acc) => {
      let balance: Decimal;
      if (['ASSET', 'EXPENSE'].includes(acc.accountType)) {
        balance = acc.totalDebit.minus(acc.totalCredit);
      } else {
        balance = acc.totalCredit.minus(acc.totalDebit);
      }

      return {
        ...acc,
        balance,
        totalDebit: acc.totalDebit.toNumber(),
        totalCredit: acc.totalCredit.toNumber(),
        balanceNumber: balance.toNumber(),
      };
    });

    // Group by account type
    const byType = accounts.reduce((acc: any, item) => {
      if (!acc[item.accountType]) {
        acc[item.accountType] = [];
      }
      acc[item.accountType].push(item);
      return acc;
    }, {});

    // Calculate totals
    const totalDebit = accounts.reduce(
      (sum, acc) => sum.plus(acc.totalDebit),
      new Decimal(0),
    );
    const totalCredit = accounts.reduce(
      (sum, acc) => sum.plus(acc.totalCredit),
      new Decimal(0),
    );

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      accounts,
      byType,
      totals: {
        totalDebit: totalDebit.toNumber(),
        totalCredit: totalCredit.toNumber(),
        difference: totalDebit.minus(totalCredit).toNumber(),
      },
    };
  }

  /**
   * Get Profit & Loss (Income Statement)
   */
  async getProfitLoss(startDate: string, endDate: string) {
    const trialBalance = await this.getTrialBalance(startDate, endDate);

    // Revenue accounts (REVENUE type)
    const revenue = trialBalance.byType.REVENUE || [];
    const totalRevenue = revenue.reduce(
      (sum: number, acc: any) => sum + acc.balanceNumber,
      0,
    );

    // Expense accounts (EXPENSE type)
    const expenses = trialBalance.byType.EXPENSE || [];
    // Total expenses calculated below by category

    // COGS (Cost of Goods Sold)
    const cogs = expenses.filter((acc: any) =>
      acc.accountCode.startsWith('50000'),
    );
    const totalCOGS = cogs.reduce(
      (sum: number, acc: any) => sum + acc.balanceNumber,
      0,
    );

    // Operating Expenses
    const operatingExpenses = expenses.filter((acc: any) =>
      acc.accountCode.startsWith('51000'),
    );
    const totalOperatingExpenses = operatingExpenses.reduce(
      (sum: number, acc: any) => sum + acc.balanceNumber,
      0,
    );

    // Other Expenses
    const otherExpenses = expenses.filter((acc: any) =>
      acc.accountCode.startsWith('52000'),
    );
    const totalOtherExpenses = otherExpenses.reduce(
      (sum: number, acc: any) => sum + acc.balanceNumber,
      0,
    );

    const grossProfit = totalRevenue - totalCOGS;
    const operatingProfit = grossProfit - totalOperatingExpenses;
    const netProfit = operatingProfit - totalOtherExpenses;

    return {
      startDate,
      endDate,
      revenue: {
        items: revenue,
        total: totalRevenue,
      },
      costOfGoodsSold: {
        items: cogs,
        total: totalCOGS,
      },
      grossProfit,
      operatingExpenses: {
        items: operatingExpenses,
        total: totalOperatingExpenses,
      },
      operatingProfit,
      otherExpenses: {
        items: otherExpenses,
        total: totalOtherExpenses,
      },
      netProfit,
    };
  }

  /**
   * Get Balance Sheet
   */
  async getBalanceSheet(asOfDate: string) {
    const date = new Date(asOfDate);

    // Get all posted entries up to date
    const entries = await this.prisma.journalEntry.findMany({
      where: {
        status: 'posted',
        entryDate: { lte: date },
      },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    // Aggregate by account
    const accountBalances: Record<string, any> = {};

    for (const entry of entries) {
      for (const line of entry.lines) {
        const accountId = line.accountId;
        if (!accountBalances[accountId]) {
          accountBalances[accountId] = {
            accountId,
            accountCode: line.account.code,
            accountName: line.account.name,
            accountType: line.account.accountType,
            totalDebit: new Decimal(0),
            totalCredit: new Decimal(0),
          };
        }

        accountBalances[accountId].totalDebit = accountBalances[
          accountId
        ].totalDebit.plus(line.debitAmount);
        accountBalances[accountId].totalCredit = accountBalances[
          accountId
        ].totalCredit.plus(line.creditAmount);
      }
    }

    // Calculate balances
    const assets = Object.values(accountBalances)
      .filter((acc: any) => acc.accountType === 'ASSET')
      .map((acc: any) => {
        const balance = acc.totalDebit.minus(acc.totalCredit);
        return {
          ...acc,
          balance: balance.toNumber(),
        };
      });

    const liabilities = Object.values(accountBalances)
      .filter((acc: any) => acc.accountType === 'LIABILITY')
      .map((acc: any) => {
        const balance = acc.totalCredit.minus(acc.totalDebit);
        return {
          ...acc,
          balance: balance.toNumber(),
        };
      });

    const equity = Object.values(accountBalances)
      .filter((acc: any) => acc.accountType === 'EQUITY')
      .map((acc: any) => {
        const balance = acc.totalCredit.minus(acc.totalDebit);
        return {
          ...acc,
          balance: balance.toNumber(),
        };
      });

    const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0);
    const totalLiabilities = liabilities.reduce(
      (sum, acc) => sum + acc.balance,
      0,
    );
    const totalEquity = equity.reduce((sum, acc) => sum + acc.balance, 0);
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

    return {
      asOfDate: date.toISOString(),
      assets: {
        items: assets,
        total: totalAssets,
      },
      liabilities: {
        items: liabilities,
        total: totalLiabilities,
      },
      equity: {
        items: equity,
        total: totalEquity,
      },
      totals: {
        totalAssets,
        totalLiabilitiesAndEquity,
        difference: totalAssets - totalLiabilitiesAndEquity,
      },
    };
  }

  /**
   * Get Cash Flow Statement
   */
  async getCashFlow(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get cash accounts
    const cashAccounts = await this.prisma.chartOfAccount.findMany({
      where: {
        code: { startsWith: '1010' },
        isHeader: false,
        isActive: true,
      },
    });

    const bankAccounts = await this.prisma.chartOfAccount.findMany({
      where: {
        code: { startsWith: '1020' },
        isHeader: false,
        isActive: true,
      },
    });

    const allCashAccounts = [...cashAccounts, ...bankAccounts];

    // Get opening balances (before start date)
    const openingEntries = await this.prisma.journalEntry.findMany({
      where: {
        status: 'posted',
        entryDate: { lt: start },
      },
      include: {
        lines: {
          where: {
            accountId: { in: allCashAccounts.map((acc) => acc.id) },
          },
        },
      },
    });

    let openingBalance = new Decimal(0);
    for (const entry of openingEntries) {
      for (const line of entry.lines) {
        openingBalance = openingBalance.plus(line.debitAmount);
        openingBalance = openingBalance.minus(line.creditAmount);
      }
    }

    // Get period transactions
    const periodEntries = await this.prisma.journalEntry.findMany({
      where: {
        status: 'posted',
        entryDate: {
          gte: start,
          lte: end,
        },
      },
      include: {
        lines: {
          where: {
            accountId: { in: allCashAccounts.map((acc) => acc.id) },
          },
          include: {
            account: true,
          },
        },
      },
    });

    // Categorize cash flows
    const operatingActivities: any[] = [];
    const investingActivities: any[] = [];
    const financingActivities: any[] = [];

    let periodNetChange = new Decimal(0);

    for (const entry of periodEntries) {
      for (const line of entry.lines) {
        const net = line.debitAmount.minus(line.creditAmount);
        periodNetChange = periodNetChange.plus(net);

        // Categorize based on account or transaction type
        // This is simplified - in production, you'd have more sophisticated categorization
        if (line.account.code.startsWith('4')) {
          // Revenue - operating
          operatingActivities.push({
            entryNumber: entry.entryNumber,
            description: entry.description,
            amount: net.toNumber(),
            date: entry.entryDate,
          });
        } else if (line.account.code.startsWith('5')) {
          // Expenses - operating
          operatingActivities.push({
            entryNumber: entry.entryNumber,
            description: entry.description,
            amount: net.toNumber(),
            date: entry.entryDate,
          });
        }
        // Add more categorization logic as needed
      }
    }

    const closingBalance = openingBalance.plus(periodNetChange);

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      openingBalance: openingBalance.toNumber(),
      operatingActivities: {
        items: operatingActivities,
        total: operatingActivities.reduce((sum, item) => sum + item.amount, 0),
      },
      investingActivities: {
        items: investingActivities,
        total: investingActivities.reduce((sum, item) => sum + item.amount, 0),
      },
      financingActivities: {
        items: financingActivities,
        total: financingActivities.reduce((sum, item) => sum + item.amount, 0),
      },
      netChange: periodNetChange.toNumber(),
      closingBalance: closingBalance.toNumber(),
    };
  }

  /**
   * Get AR Aging Report (delegates to AR service)
   */
  async getARAging(asOfDate?: string) {
    return this.arService.getAgingReport(asOfDate);
  }

  /**
   * Get Expense Summary
   */
  async getExpenseSummary(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const expenses = await this.prisma.expense.findMany({
      where: {
        expenseDate: {
          gte: start,
          lte: end,
        },
        status: { in: ['approved', 'paid'] },
      },
      include: {
        glAccount: true,
        branch: true,
        department: true,
      },
    });

    // Group by category
    const byCategory = expenses.reduce((acc: any, exp) => {
      if (!acc[exp.expenseCategory]) {
        acc[exp.expenseCategory] = [];
      }
      acc[exp.expenseCategory].push({
        expenseNumber: exp.expenseNumber,
        date: exp.expenseDate,
        amount: exp.totalAmount.toNumber(),
        description: exp.description,
        branch: exp.branch?.name,
        department: exp.department?.name,
      });
      return acc;
    }, {});

    // Group by GL account
    const byGLAccount = expenses.reduce((acc: any, exp) => {
      const accountCode = exp.glAccount.code;
      if (!acc[accountCode]) {
        acc[accountCode] = {
          accountCode,
          accountName: exp.glAccount.name,
          items: [],
          total: 0,
        };
      }
      acc[accountCode].items.push({
        expenseNumber: exp.expenseNumber,
        date: exp.expenseDate,
        amount: exp.totalAmount.toNumber(),
        description: exp.description,
      });
      acc[accountCode].total += exp.totalAmount.toNumber();
      return acc;
    }, {});

    const total = expenses.reduce(
      (sum, exp) => sum + exp.totalAmount.toNumber(),
      0,
    );

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      total,
      byCategory,
      byGLAccount: Object.values(byGLAccount),
      count: expenses.length,
    };
  }
}

