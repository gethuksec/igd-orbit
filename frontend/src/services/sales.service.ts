import { api } from './api';

export interface SalesTransaction {
  id: string;
  transactionNumber: string;
  customerId?: string;
  customer?: { id: string; name: string };
  totalPrice: number;
  status: string;
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
};
