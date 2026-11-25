import { api, handleApiError } from './api';

export interface Category {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  isActive: boolean;
  tierMargins?: Record<string, number>;
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
    totalGrades?: number;
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

  async generateCode(): Promise<{ code: string }> {
    try {
      const response = await api.get('/categories/generate-code');
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // IGDERP-317 — CategoryGrade scoped master
  async listGrades(categoryId: string, activeOnly = false): Promise<any[]> {
    try {
      const response = await api.get(`/categories/${categoryId}/grades`, {
        params: activeOnly ? { activeOnly: 'true' } : undefined,
      });
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async generateGradeCode(): Promise<{ code: string }> {
    try {
      const response = await api.get('/categories/generate-grade-code');
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createGrade(categoryId: string, data: any): Promise<any> {
    try {
      const response = await api.post(`/categories/${categoryId}/grades`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async updateGrade(categoryId: string, gradeId: string, data: any): Promise<any> {
    try {
      const response = await api.put(`/categories/${categoryId}/grades/${gradeId}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async deleteGrade(categoryId: string, gradeId: string): Promise<void> {
    try {
      await api.delete(`/categories/${categoryId}/grades/${gradeId}`);
    } catch (error: any) {
      throw error;
    }
  },
};

