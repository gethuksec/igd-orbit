import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { ChartOfAccountsService } from './services/chart-of-accounts.service';
import { JournalEntriesService } from './services/journal-entries.service';
import { ExpensesService } from './services/expenses.service';
import { PettyCashService } from './services/petty-cash.service';
import { AccountsReceivableService } from './services/accounts-receivable.service';
import { FinancialReportsService } from './services/financial-reports.service';
import { ChartOfAccountsController } from './chart-of-accounts.controller';
import { JournalEntriesController } from './journal-entries.controller';
import { ExpensesController } from './expenses.controller';
import { PettyCashController } from './petty-cash.controller';
import { AccountsReceivableController } from './accounts-receivable.controller';
import { FinancialReportsController } from './financial-reports.controller';

@Module({
  providers: [
    PrismaService,
    ChartOfAccountsService,
    JournalEntriesService,
    ExpensesService,
    PettyCashService,
    AccountsReceivableService,
    FinancialReportsService,
  ],
  controllers: [
    ChartOfAccountsController,
    JournalEntriesController,
    ExpensesController,
    PettyCashController,
    AccountsReceivableController,
    FinancialReportsController,
  ],
  exports: [
    ChartOfAccountsService,
    JournalEntriesService,
    ExpensesService,
    PettyCashService,
    AccountsReceivableService,
    FinancialReportsService,
  ],
})
export class FinanceModule {}

