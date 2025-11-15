import { api, handleApiError } from './api';

export interface Supplier {
  id: string;
  code: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierListResponse {
  data: Supplier[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const suppliersService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<SupplierListResponse> {
    try {
      const response = await api.get('/suppliers', { params });
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

  async getById(id: string): Promise<Supplier> {
    try {
      const response = await api.get(`/suppliers/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<Supplier> {
    try {
      const response = await api.post('/suppliers', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<Supplier> {
    try {
      const response = await api.put(`/suppliers/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/suppliers/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};

