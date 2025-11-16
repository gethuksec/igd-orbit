import { api, handleApiError } from './api';

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  customerType: string;
  tier: {
    id: string;
    code: string;
    name: string;
    discountPercentage: number;
  } | null;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  isBlacklisted: boolean;
  isActive: boolean;
  preferredBranch?: {
    id: string;
    name: string;
    code: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  data: Customer[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const customersService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    tier?: string;
  }): Promise<CustomerListResponse> {
    try {
      const response = await api.get('/customers', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: {
          page: params?.page || 1,
          limit: params?.limit || 20,
          total: 0,
          totalPages: 0,
        },
      });
    }
  },

  async getById(id: string): Promise<Customer> {
    try {
      const response = await api.get(`/customers/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<Customer> {
    const response = await api.post('/customers', data);
    return response.data.data || response.data;
  },

  async update(id: string, data: any): Promise<Customer> {
    const response = await api.put(`/customers/${id}`, data);
    return response.data.data || response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/customers/${id}`);
  },
};

