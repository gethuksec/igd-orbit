import { api, handleApiError } from './api';

export interface Category {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryListResponse {
  data: Category[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const categoriesService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    'filter[isActive]'?: boolean;
  }): Promise<CategoryListResponse> {
    try {
      const response = await api.get('/categories', { params });
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

  async getById(id: string): Promise<Category> {
    try {
      const response = await api.get(`/categories/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<Category> {
    try {
      const response = await api.post('/categories', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<Category> {
    try {
      const response = await api.put(`/categories/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/categories/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};

