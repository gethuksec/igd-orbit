import { api, handleApiError } from './api';

// Chart of Accounts
export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  parentId?: string;
  parent?: ChartOfAccount;
  children?: ChartOfAccount[];
  level: number;
  isActive: boolean;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChartOfAccountListResponse {
  data: ChartOfAccount[];
}

// Journal Entries
export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  entryType: 'manual' | 'auto';
  description: string;
  status: 'draft' | 'posted' | 'reversed';
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  createdBy: string;
  postedBy?: string;
  postedAt?: string;
  reversedBy?: string;
  reversedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryLine {
  id: string;
  accountId: string;
  account?: ChartOfAccount;
  debit: number;
  credit: number;
  description?: string;
}

export interface JournalEntryListResponse {
  data: JournalEntry[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Expenses
export interface Expense {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  branchId: string;
  branch?: { id: string; name: string; code: string };
  departmentId?: string;
  department?: { id: string; name: string };
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  paidBy?: string;
  paidAt?: string;
  paymentMethod?: string;
  attachments?: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseListResponse {
  data: Expense[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Petty Cash
export interface PettyCashFund {
  id: string;
  fundNumber: string;
  branchId: string;
  branch?: { id: string; name: string; code: string };
  custodianId: string;
  custodian?: { id: string; name: string };
  initialAmount: number;
  currentBalance: number;
  status: 'active' | 'closed';
  transactions: PettyCashTransaction[];
  createdAt: string;
  updatedAt: string;
}

export interface PettyCashTransaction {
  id: string;
  transactionDate: string;
  type: 'deposit' | 'withdrawal' | 'reconciliation';
  amount: number;
  description: string;
  receiptNumber?: string;
  createdBy: string;
  createdAt: string;
}

export interface PettyCashListResponse {
  data: PettyCashFund[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Accounts Receivable
export interface AccountsReceivable {
  id: string;
  arNumber: string;
  customerId: string;
  customer?: { id: string; name: string; customerCode: string };
  transactionId?: string;
  transaction?: { id: string; transactionNumber: string };
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate: string;
  originalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: 'open' | 'partial' | 'paid' | 'overdue' | 'written-off';
  agingDays: number;
  payments: ARPayment[];
  createdAt: string;
  updatedAt: string;
}

export interface ARPayment {
  id: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface ARListResponse {
  data: AccountsReceivable[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const financeService = {
  // Chart of Accounts
  async getChartOfAccounts(): Promise<ChartOfAccountListResponse> {
    try {
      const response = await api.get('/chart-of-accounts');
      return response.data;
    } catch (error: any) {
      return handleApiError(error, { data: [] });
    }
  },

  async getAccountById(id: string): Promise<ChartOfAccount> {
    try {
      const response = await api.get(`/chart-of-accounts/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createAccount(data: {
    code: string;
    name: string;
    accountType: string;
    parentId?: string;
    isActive?: boolean;
  }): Promise<ChartOfAccount> {
    try {
      const response = await api.post('/chart-of-accounts', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async updateAccount(id: string, data: Partial<ChartOfAccount>): Promise<ChartOfAccount> {
    try {
      const response = await api.put(`/chart-of-accounts/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Journal Entries
  async getJournalEntries(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
    entryType?: string;
  }): Promise<JournalEntryListResponse> {
    try {
      const response = await api.get('/journal-entries', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getJournalEntryById(id: string): Promise<JournalEntry> {
    try {
      const response = await api.get(`/journal-entries/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createJournalEntry(data: {
    entryDate: string;
    description: string;
    lines: Array<{ accountId: string; debit: number; credit: number; description?: string }>;
    notes?: string;
  }): Promise<JournalEntry> {
    try {
      const response = await api.post('/journal-entries', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async updateJournalEntry(id: string, data: Partial<JournalEntry>): Promise<JournalEntry> {
    try {
      const response = await api.put(`/journal-entries/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async postJournalEntry(id: string): Promise<JournalEntry> {
    try {
      const response = await api.put(`/journal-entries/${id}/post`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async reverseJournalEntry(id: string, data: { reason: string }): Promise<JournalEntry> {
    try {
      const response = await api.post(`/journal-entries/${id}/reverse`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Expenses
  async getExpenses(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    status?: string;
    branchId?: string;
    departmentId?: string;
  }): Promise<ExpenseListResponse> {
    try {
      const response = await api.get('/expenses', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getExpenseById(id: string): Promise<Expense> {
    try {
      const response = await api.get(`/expenses/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createExpense(data: {
    expenseDate: string;
    category: string;
    description: string;
    amount: number;
    branchId: string;
    departmentId?: string;
    attachments?: string[];
    notes?: string;
  }): Promise<Expense> {
    try {
      const response = await api.post('/expenses', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async approveExpense(id: string, data: { notes?: string }): Promise<Expense> {
    try {
      const response = await api.put(`/expenses/${id}/approve`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async rejectExpense(id: string, data: { reason: string }): Promise<Expense> {
    try {
      const response = await api.put(`/expenses/${id}/reject`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async payExpense(id: string, data: {
    paymentMethod: string;
    paymentDate: string;
    referenceNumber?: string;
    notes?: string;
  }): Promise<Expense> {
    try {
      const response = await api.put(`/expenses/${id}/pay`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Petty Cash
  async getPettyCashFunds(params?: {
    page?: number;
    limit?: number;
    branchId?: string;
    status?: string;
  }): Promise<PettyCashListResponse> {
    try {
      const response = await api.get('/petty-cash', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getPettyCashFundById(id: string): Promise<PettyCashFund> {
    try {
      const response = await api.get(`/petty-cash/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createPettyCashFund(data: {
    branchId: string;
    custodianId: string;
    initialAmount: number;
  }): Promise<PettyCashFund> {
    try {
      const response = await api.post('/petty-cash', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async recordPettyCashTransaction(fundId: string, data: {
    transactionDate: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
    description: string;
    receiptNumber?: string;
  }): Promise<PettyCashTransaction> {
    try {
      const response = await api.post(`/petty-cash/${fundId}/transactions`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async reconcilePettyCash(fundId: string, data: {
    actualBalance: number;
    notes?: string;
  }): Promise<PettyCashFund> {
    try {
      const response = await api.put(`/petty-cash/${fundId}/reconcile`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Accounts Receivable
  async getAccountsReceivable(params?: {
    page?: number;
    limit?: number;
    customerId?: string;
    status?: string;
    agingDays?: number;
  }): Promise<ARListResponse> {
    try {
      const response = await api.get('/accounts-receivable', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getARById(id: string): Promise<AccountsReceivable> {
    try {
      const response = await api.get(`/accounts-receivable/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async recordARPayment(id: string, data: {
    paymentDate: string;
    amount: number;
    paymentMethod: string;
    referenceNumber?: string;
    notes?: string;
  }): Promise<ARPayment> {
    try {
      const response = await api.post(`/accounts-receivable/${id}/payments`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async writeOffAR(id: string, data: { reason: string }): Promise<AccountsReceivable> {
    try {
      const response = await api.put(`/accounts-receivable/${id}/write-off`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

