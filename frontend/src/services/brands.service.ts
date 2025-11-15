import { api, handleApiError } from './api';

export interface Brand {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BrandListResponse {
  data: Brand[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const brandsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    'filter[isActive]'?: boolean;
  }): Promise<BrandListResponse> {
    try {
      const response = await api.get('/brands', { params });
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

  async getById(id: string): Promise<Brand> {
    try {
      const response = await api.get(`/brands/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<Brand> {
    try {
      const response = await api.post('/brands', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<Brand> {
    try {
      const response = await api.put(`/brands/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/brands/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};

