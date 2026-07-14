import { api, handleApiError } from './api';

export interface CustomerTier {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountPercentage: number;
  level: number;
  isActive: boolean;
  createdAt: string;
}

export interface CustomerTierListResponse {
  data: CustomerTier[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const customerTiersService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<CustomerTierListResponse> {
    try {
      const response = await api.get('/customer-tiers', { params });
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

  async getById(id: string): Promise<CustomerTier> {
    try {
      const response = await api.get(`/customer-tiers/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<CustomerTier> {
    try {
      const response = await api.post('/customer-tiers', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<CustomerTier> {
    try {
      const response = await api.put(`/customer-tiers/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/customer-tiers/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};
