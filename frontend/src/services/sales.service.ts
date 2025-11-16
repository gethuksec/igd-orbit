import { api } from './api';

export interface SalesTransaction {
  id: string;
  transactionNumber: string;
  customerId?: string;
  customer?: { id: string; name: string };
  totalPrice: number;
  status: string;
  items?: Array<{ id: string; productId: string; quantity: number; unitPrice: number }>;
  createdAt: string;
}

export interface SalesTransactionListResponse {
  data: SalesTransaction[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ProductSearchResult {
  id: string;
  name: string;
  sku: string;
  sellingPrice: number;
  stock?: {
    quantityAvailable: number;
    quantityReserved: number;
  };
  images?: string[];
}

export interface CustomerSearchResult {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  email?: string;
  tier?:
    | {
        code: string;
        name: string;
        discountPercentage?: number;
      }
    | string
    | null;
  creditLimit: number;
  creditUsed: number;
}

export const salesService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<SalesTransactionListResponse> {
    const response = await api.get('/sales/transactions', { params });
    return response.data;
  },

  async getById(id: string): Promise<SalesTransaction> {
    const response = await api.get(`/sales/transactions/${id}`);
    return response.data.data || response.data;
  },

  async createTransaction(data: any): Promise<SalesTransaction> {
    const response = await api.post('/sales/transactions', data);
    return response.data.data || response.data;
  },

  async searchProducts(query: string): Promise<ProductSearchResult[]> {
    const response = await api.get('/products', {
      params: { search: query, limit: 10 },
    });
    return response.data.data || [];
  },

  async getProductByBarcode(barcode: string): Promise<ProductSearchResult | null> {
    try {
      const response = await api.get('/products', {
        params: { search: barcode, limit: 1 },
      });
      const products = response.data.data || [];
      return products.find((p: any) => p.sku === barcode || p.barcode === barcode) || null;
    } catch {
      return null;
    }
  },

  async searchCustomers(query: string): Promise<CustomerSearchResult[]> {
    const response = await api.get('/customers', {
      params: { search: query, limit: 10 },
    });
    return response.data.data || [];
  },

  async getHeldTransactions(branchId: string): Promise<SalesTransaction[]> {
    const response = await api.get('/sales/transactions', {
      params: { status: 'held', branchId },
    });
    return response.data.data || [];
  },

  async holdTransaction(transactionId: string, reference?: string): Promise<void> {
    await api.put(`/sales/transactions/${transactionId}/hold`, { reference });
  },

  async resumeTransaction(transactionId: string): Promise<SalesTransaction> {
    const response = await api.put(`/sales/transactions/${transactionId}/resume`);
    return response.data.data || response.data;
  },

  async generateReceipt(transactionId: string): Promise<Blob> {
    const response = await api.get(`/sales/transactions/${transactionId}/receipt`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
