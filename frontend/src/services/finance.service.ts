import { api } from './api';

// ==================== Chart of Accounts ====================

export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parentId?: string | null;
  parent?: ChartOfAccount | null;
  children?: ChartOfAccount[];
  isHeader: boolean;
  isActive: boolean;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ==================== Journal Entries ====================

export interface JournalLine {
  id?: string;
  account_id: string;
  account?: ChartOfAccount;
  debit_amount: number;
  credit_amount: number;
  line_description?: string;
  branch_id?: string;
  department_id?: string;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  entryType: 'manual' | 'auto';
  description: string;
  status: 'draft' | 'posted' | 'locked';
  lines: JournalLine[];
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdBy: string;
  postedBy?: string;
  postedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateJournalEntryDto {
  entry_number?: string;
  entry_date: string;
  entry_type: 'manual' | 'auto';
  description: string;
  lines: JournalLine[];
  reference_type?: string;
  reference_id?: string;
  notes?: string;
}

export interface UpdateJournalEntryDto {
  entry_date?: string;
  description?: string;
  lines?: JournalLine[];
  notes?: string;
}

export interface ReverseJournalEntryDto {
  reverse_date: string;
  reason: string;
}

// ==================== Expenses ====================

export interface Expense {
  id: string;
  expenseNumber: string;
  expenseCategory: string;
  expenseDate: string;
  amount: number;
  taxAmount?: number;
  totalAmount: number;
  paymentMethod?: 'cash' | 'transfer' | 'petty-cash';
  bankAccountId?: string;
  branchId?: string;
  departmentId?: string;
  glAccountId: string;
  glAccount?: ChartOfAccount;
  description: string;
  receiptUrl?: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  paidBy?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseDto {
  expense_category: string;
  expense_date: string;
  amount: number;
  tax_amount?: number;
  payment_method?: 'cash' | 'transfer' | 'petty-cash';
  bank_account_id?: string;
  branch_id?: string;
  department_id?: string;
  gl_account_id: string;
  description: string;
  receipt_url?: string;
  notes?: string;
}

export interface ApproveExpenseDto {
  notes?: string;
}

export interface RejectExpenseDto {
  rejection_reason: string;
}

export interface PayExpenseDto {
  payment_date: string;
  payment_method: 'cash' | 'transfer' | 'petty-cash';
  bank_account_id?: string;
  notes?: string;
}

// ==================== Petty Cash ====================

export interface PettyCashFund {
  id: string;
  fundNumber: string;
  branchId: string;
  branch?: { id: string; name: string; code: string };
  openingBalance: number;
  currentBalance: number;
  custodianId: string;
  custodian?: { id: string; name: string };
  periodStart: string;
  periodEnd?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  transactions?: PettyCashTransaction[];
}

export interface PettyCashTransaction {
  id: string;
  fundId: string;
  transactionDate: string;
  transactionType: 'expense' | 'replenishment';
  amount: number;
  description: string;
  category?: string;
  receiptUrl?: string;
  createdBy: string;
  createdAt: string;
}

export interface CreatePettyCashFundDto {
  fund_number?: string;
  branch_id: string;
  opening_balance: number;
  custodian_id: string;
  period_start: string;
  period_end?: string;
}

export interface RecordPettyCashTransactionDto {
  transaction_date: string;
  transaction_type: 'expense' | 'replenishment';
  amount: number;
  description: string;
  category?: string;
  receipt_url?: string;
}

export interface ReconcilePettyCashDto {
  reconciliation_date: string;
  actual_balance: number;
  notes?: string;
}

// ==================== Accounts Receivable ====================

export interface AccountsReceivable {
  id: string;
  customerId: string;
  customer?: { id: string; name: string; phone: string };
  transactionId: string;
  transactionType: 'SALES' | 'SERVICE';
  transactionNumber: string;
  invoiceDate: string;
  dueDate: string;
  originalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  agingDays: number;
  agingBucket: 'current' | '30' | '60' | '90+';
  status: 'open' | 'partial' | 'paid' | 'written_off';
  payments?: ARPayment[];
  createdAt: string;
  updatedAt: string;
}

export interface ARPayment {
  id: string;
  arId: string;
  paymentDate: string;
  paymentAmount: number;
  paymentMethod: 'cash' | 'transfer' | 'check';
  bankAccountId?: string;
  referenceNumber?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface RecordARPaymentDto {
  payment_date: string;
  payment_amount: number;
  payment_method: 'cash' | 'transfer' | 'check';
  bank_account_id?: string;
  reference_number?: string;
  notes?: string;
}

export interface WriteOffARDto {
  write_off_date: string;
  reason: string;
  notes?: string;
}

export interface ARAgingReport {
  customerId: string;
  customerName: string;
  totalOutstanding: number;
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
  items: AccountsReceivable[];
}

// ==================== Financial Reports ====================

export interface TrialBalanceItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  debitBalance: number;
  creditBalance: number;
}

export interface ProfitLossItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  amount: number;
  isRevenue: boolean;
}

export interface BalanceSheetItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  balance: number;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY';
}

export interface CashFlowItem {
  category: string;
  description: string;
  amount: number;
  isInflow: boolean;
}

// ==================== Finance Service ====================

export const financeService = {
  // Chart of Accounts
  async getChartOfAccounts(): Promise<ChartOfAccount[]> {
    try {
      const response = await api.get('/chart-of-accounts');
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async getChartOfAccountById(id: string): Promise<ChartOfAccount> {
    try {
      const response = await api.get(`/chart-of-accounts/${id}`);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async getChartOfAccountsByType(type: string): Promise<ChartOfAccount[]> {
    try {
      const response = await api.get(`/chart-of-accounts/type/${type}`);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async seedChartOfAccounts() {
    try {
      const response = await api.post('/chart-of-accounts/seed');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Journal Entries
  async getJournalEntries(params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    entryType?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: JournalEntry[]; meta?: any }> {
    try {
      const response = await api.get('/journal-entries', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getJournalEntryById(id: string): Promise<JournalEntry> {
    try {
      const response = await api.get(`/journal-entries/${id}`);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async createJournalEntry(dto: CreateJournalEntryDto): Promise<JournalEntry> {
    try {
      const response = await api.post('/journal-entries', dto);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async updateJournalEntry(id: string, dto: UpdateJournalEntryDto): Promise<JournalEntry> {
    try {
      const response = await api.put(`/journal-entries/${id}`, dto);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async deleteJournalEntry(id: string): Promise<void> {
    try {
      await api.delete(`/journal-entries/${id}`);
    } catch (error) {
      throw error;
    }
  },

  async postJournalEntry(id: string): Promise<JournalEntry> {
    try {
      const response = await api.post(`/journal-entries/${id}/post`);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async reverseJournalEntry(id: string, dto: ReverseJournalEntryDto): Promise<JournalEntry> {
    try {
      const response = await api.post(`/journal-entries/${id}/reverse`, dto);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  // Expenses
  async getExpenses(params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    branchId?: string;
    departmentId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Expense[]; meta?: any }> {
    try {
      const response = await api.get('/expenses', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getExpenseById(id: string): Promise<Expense> {
    try {
      const response = await api.get(`/expenses/${id}`);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async createExpense(dto: CreateExpenseDto): Promise<Expense> {
    try {
      const response = await api.post('/expenses', dto);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async updateExpense(id: string, dto: Partial<CreateExpenseDto>): Promise<Expense> {
    try {
      const response = await api.put(`/expenses/${id}`, dto);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async approveExpense(id: string, dto: ApproveExpenseDto): Promise<Expense> {
    try {
      const response = await api.post(`/expenses/${id}/approve`, dto);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async rejectExpense(id: string, dto: RejectExpenseDto): Promise<Expense> {
    try {
      const response = await api.post(`/expenses/${id}/reject`, dto);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async payExpense(id: string, dto: PayExpenseDto): Promise<Expense> {
    try {
      const response = await api.post(`/expenses/${id}/pay`, dto);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  // Petty Cash
  async getPettyCashFunds(params?: {
    branchId?: string;
    isActive?: boolean;
  }): Promise<PettyCashFund[]> {
    try {
      const response = await api.get('/petty-cash', { params });
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async getPettyCashFundById(id: string): Promise<PettyCashFund> {
    try {
      const response = await api.get(`/petty-cash/${id}`);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async createPettyCashFund(dto: CreatePettyCashFundDto): Promise<PettyCashFund> {
    try {
      const response = await api.post('/petty-cash', dto);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async recordPettyCashTransaction(
    fundId: string,
    dto: RecordPettyCashTransactionDto,
  ): Promise<PettyCashTransaction> {
    try {
      const response = await api.post(`/petty-cash/${fundId}/transactions`, dto);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async reconcilePettyCash(fundId: string, dto: ReconcilePettyCashDto): Promise<PettyCashFund> {
    try {
      const response = await api.post(`/petty-cash/${fundId}/reconcile`, dto);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  // Accounts Receivable
  async getARAgingReport(asOfDate?: string): Promise<ARAgingReport[]> {
    try {
      const response = await api.get('/accounts-receivable', {
        params: { asOfDate },
      });
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async getCustomerAR(customerId: string): Promise<AccountsReceivable[]> {
    try {
      const response = await api.get(`/accounts-receivable/${customerId}`);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async recordARPayment(arId: string, dto: RecordARPaymentDto): Promise<ARPayment> {
    try {
      const response = await api.post(`/accounts-receivable/${arId}/payment`, dto);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async writeOffAR(arId: string, dto: WriteOffARDto): Promise<AccountsReceivable> {
    try {
      const response = await api.post(`/accounts-receivable/${arId}/writeoff`, dto);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  // Financial Reports
  async getTrialBalance(startDate: string, endDate: string): Promise<TrialBalanceItem[]> {
    try {
      const response = await api.get('/financial-reports/trial-balance', {
        params: { startDate, endDate },
      });
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async getProfitLoss(startDate: string, endDate: string): Promise<ProfitLossItem[]> {
    try {
      const response = await api.get('/financial-reports/profit-loss', {
        params: { startDate, endDate },
      });
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async getBalanceSheet(asOfDate: string): Promise<BalanceSheetItem[]> {
    try {
      const response = await api.get('/financial-reports/balance-sheet', {
        params: { asOfDate },
      });
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async getCashFlow(startDate: string, endDate: string): Promise<CashFlowItem[]> {
    try {
      const response = await api.get('/financial-reports/cash-flow', {
        params: { startDate, endDate },
      });
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async getARAgingReportForReports(asOfDate?: string): Promise<ARAgingReport[]> {
    try {
      const response = await api.get('/financial-reports/ar-aging', {
        params: { asOfDate },
      });
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  async getExpenseSummary(startDate: string, endDate: string): Promise<any> {
    try {
      const response = await api.get('/financial-reports/expense-summary', {
        params: { startDate, endDate },
      });
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },
};
