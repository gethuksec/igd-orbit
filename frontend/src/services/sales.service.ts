import { api } from './api';

export interface SalesTransaction {
  id: string;
  transactionNumber: string;
  customerId?: string;
  customer?: { id: string; name: string; customerCode?: string };
  branch?: { id: string; name: string; code?: string };
  total?: number;
  totalPrice?: number;
  status: string;
  paymentStatus?: string;
  receiptNotes?: string;
  internalNotes?: string;
  itemCount?: number;
  items?: Array<{
    id: string;
    productId: string;
    product?: { id: string; name: string; sku?: string };
    productName?: string;
    productSku?: string;
    quantity: number;
    unitPrice: number;
  }>;
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
  trackSerial?: boolean;
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
    branchId?: string;
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

  async searchProducts(query: string, branchId?: string): Promise<ProductSearchResult[]> {
    const response = await api.get('/products', {
      params: { 
        search: query, 
        limit: 10,
        include: 'stock',
        ...(branchId ? { 'filter[branchId]': branchId } : {}),
      },
    });
    const products = response.data.data || [];
    
    // Transform to match ProductSearchResult interface with stock info
    return products.map((p: any) => {
      // Get stock for specific branch or total stock
      let stockInfo = null;
      if (branchId && p.stockSummary?.branches) {
        const branchStock = p.stockSummary.branches.find(
          (b: any) => b.branchId === branchId
        );
        if (branchStock) {
          stockInfo = {
            quantityAvailable: branchStock.available,
            quantityReserved: branchStock.reserved,
          };
        }
      }
      
      // Fallback to total stock if no branch-specific stock
      if (!stockInfo && p.stockSummary) {
        stockInfo = {
          quantityAvailable: p.stockSummary.totalAvailable - p.stockSummary.totalReserved,
          quantityReserved: p.stockSummary.totalReserved,
        };
      }
      
      // Fallback to totalStock if no stockSummary
      if (!stockInfo) {
        stockInfo = {
          quantityAvailable: p.totalStock || 0,
          quantityReserved: 0,
        };
      }
      
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        sellingPrice: p.sellingPrice || p.effectivePrice || 0,
        trackSerial: p.trackSerial || false,
        stock: stockInfo,
        images: p.images || [],
      };
    });
  },

  async getProductByBarcode(barcode: string, branchId?: string): Promise<ProductSearchResult | null> {
    try {
      const response = await api.get('/products', {
        params: { 
          search: barcode, 
          limit: 1,
          include: 'stock',
          ...(branchId ? { 'filter[branchId]': branchId } : {}),
        },
      });
      const products = response.data.data || [];
      const product = products.find((p: any) => p.sku === barcode || p.barcode === barcode);
      
      if (!product) return null;
      
      // Transform stock info similar to searchProducts
      let stockInfo = null;
      if (branchId && product.stockSummary?.branches) {
        const branchStock = product.stockSummary.branches.find(
          (b: any) => b.branchId === branchId
        );
        if (branchStock) {
          stockInfo = {
            quantityAvailable: branchStock.available,
            quantityReserved: branchStock.reserved,
          };
        }
      }
      
      if (!stockInfo && product.stockSummary) {
        stockInfo = {
          quantityAvailable: product.stockSummary.totalAvailable - product.stockSummary.totalReserved,
          quantityReserved: product.stockSummary.totalReserved,
        };
      }
      
      if (!stockInfo) {
        stockInfo = {
          quantityAvailable: product.totalStock || 0,
          quantityReserved: 0,
        };
      }
      
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        sellingPrice: product.sellingPrice || product.effectivePrice || 0,
        trackSerial: product.trackSerial || false,
        stock: stockInfo,
        images: product.images || [],
      };
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
    await api.post(`/sales/transactions/${transactionId}/hold`, { reference });
  },

  async resumeTransaction(transactionId: string): Promise<SalesTransaction> {
    const response = await api.post(`/sales/transactions/${transactionId}/resume`);
    return response.data.data || response.data;
  },

  async generateReceipt(transactionId: string): Promise<Blob> {
    const response = await api.post(`/sales/transactions/${transactionId}/receipt`);
    return response.data;
  },

  async voidTransaction(transactionId: string, reason: string): Promise<void> {
    await api.post(`/sales/transactions/${transactionId}/void`, { reason });
  },
};
