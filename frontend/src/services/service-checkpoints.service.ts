import { api } from './api';
import type {
  ServiceCheckpoint,
  ServiceCheckpointListResponse,
} from '@/types/service';

export const serviceCheckpointsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'active' | 'inactive' | 'all';
  }): Promise<ServiceCheckpointListResponse> {
    const response = await api.get('/service-checkpoints', { params });
    const raw = response.data;

    if (raw && Array.isArray(raw.data)) {
      return raw as ServiceCheckpointListResponse;
    }
    if (Array.isArray(raw)) {
      return {
        data: raw,
        meta: { page: params?.page ?? 1, limit: params?.limit ?? raw.length, total: raw.length, totalPages: 1 },
      };
    }
    return { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } };
  },

  /** Active checkpoints only, sorted by sortOrder — used by service forms */
  async getActive(): Promise<ServiceCheckpoint[]> {
    const response = await api.get('/service-checkpoints/active');
    return response.data?.data || response.data || [];
  },

  async create(data: { name: string; isActive?: boolean; sortOrder?: number }): Promise<ServiceCheckpoint> {
    const response = await api.post('/service-checkpoints', data);
    return response.data?.data || response.data;
  },

  async update(id: string, data: { name?: string; isActive?: boolean; sortOrder?: number }): Promise<ServiceCheckpoint> {
    const response = await api.put(`/service-checkpoints/${id}`, data);
    return response.data?.data || response.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/service-checkpoints/${id}`);
  },
};
