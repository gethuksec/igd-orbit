import { api } from './api';

/**
 * Product search result
 */
export interface ProductSearchResult {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  sellingPrice: number;
  images?: string[];
  stock?: {
    quantityAvailable: number;
    quantityReserved: number;
  };
}

/**
 * Transaction item for creation
 */
export interface TransactionItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
  discountAmount?: number;
  batchNumber?: string;
  serialNumber?: string;
  notes?: string;
}

/**
 * Payment data
 */
export interface PaymentData {
  method: 'cash' | 'card' | 'transfer' | 'e-wallet' | 'credit';
  amount: number;
  details?: Record<string, any>;
}

/**
 * Create transaction payload
 */
export interface CreateTransactionPayload {
  transactionType: 'pos' | 'order' | 'pre-order';
  customerId?: string;
  branchId: string;
  items: TransactionItem[];
  discountPercentage?: number;
  discountAmount?: number;
  taxPercentage?: number;
  payment: PaymentData;
  notes?: string;
}

/**
 * Customer search result
 */
export interface CustomerSearchResult {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  email?: string;
  tier?: {
    code: string;
    name: string;
    discountPercentage: number;
  };
  creditLimit?: number;
  creditUsed?: number;
}

/**
 * Held transaction
 */
export interface HeldTransaction {
  id: string;
  reference?: string;
  transactionData: any;
  branch: {
    id: string;
    name: string;
  };
  cashier: {
    id: string;
    fullName: string;
  };
  expiresAt: string;
  createdAt: string;
}

/**
 * Sales API Service
 */
export const salesService = {
  /**
   * Search products with autocomplete
   */
  async searchProducts(query: string): Promise<ProductSearchResult[]> {
    const response = await api.get('/products', {
      params: {
        search: query,
        limit: 20,
        include: ['stock'],
      },
    });
    return response.data.data || [];
  },

  /**
   * Get product by barcode
   */
  async getProductByBarcode(barcode: string): Promise<ProductSearchResult | null> {
    try {
      const response = await api.get('/products', {
        params: {
          search: barcode,
          limit: 1,
          include: ['stock'],
        },
      });
      const products = response.data.data || [];
      // Find exact barcode match
      const product = products.find((p: any) => p.barcode === barcode);
      return product || null;
    } catch (error) {
      return null;
    }
  },

  /**
   * Create transaction
   */
  async createTransaction(payload: CreateTransactionPayload) {
    const response = await api.post('/sales/transactions', payload);
    return response.data;
  },

  /**
   * Void transaction
   */
  async voidTransaction(id: string, reason: string) {
    const response = await api.post(`/sales/transactions/${id}/void`, { reason });
    return response.data;
  },

  /**
   * Hold transaction
   */
  async holdTransaction(transactionId: string, reference?: string) {
    const response = await api.post(`/sales/transactions/${transactionId}/hold`, {
      reference,
    });
    return response.data;
  },

  /**
   * Get held transactions
   */
  async getHeldTransactions(branchId?: string): Promise<HeldTransaction[]> {
    const response = await api.get('/sales/transactions/held/list', {
      params: { branchId },
    });
    return response.data.data || [];
  },

  /**
   * Resume held transaction
   */
  async resumeTransaction(holdId: string) {
    const response = await api.post(`/sales/transactions/${holdId}/resume`);
    return response.data;
  },

  /**
   * Generate receipt
   */
  async generateReceipt(transactionId: string): Promise<string> {
    const response = await api.post(`/sales/transactions/${transactionId}/receipt`);
    return response.data.receiptUrl;
  },

  /**
   * Search customers
   */
  async searchCustomers(query: string): Promise<CustomerSearchResult[]> {
    const response = await api.get('/customers', {
      params: {
        search: query,
        limit: 20,
      },
    });
    return response.data.data || [];
  },
};

