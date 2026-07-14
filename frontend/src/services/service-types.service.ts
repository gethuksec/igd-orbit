import { api, handleApiError } from './api';

export interface ServiceType {
  id: string;
  code: string;
  name: string;
  description?: string;
  basePrice: number;
  minPrice?: number;
  maxPrice?: number;
  slaHours: number;
  isActive: boolean;
  serviceOrderCount?: number;
  createdAt: string;
  updatedAt: string;
}

export const serviceTypesService = {
  async getAll(params?: { status?: string }): Promise<ServiceType[]> {
    try {
      const response = await api.get('/service-types', { params });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getById(id: string): Promise<ServiceType> {
    try {
      const response = await api.get(`/service-types/${id}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<ServiceType> {
    try {
      const response = await api.post('/service-types', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<ServiceType> {
    try {
      const response = await api.put(`/service-types/${id}`, data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/service-types/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};

