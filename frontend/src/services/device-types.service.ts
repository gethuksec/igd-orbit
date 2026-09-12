import { api } from './api';
import type {
  DeviceType,
  DeviceTypeListResponse,
} from '@/types/service';

// IGDERP-169: device type master client (mirrors service-checkpoints.service).
export const deviceTypesService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: 'active' | 'inactive' | 'all';
  }): Promise<DeviceTypeListResponse> {
    const response = await api.get('/device-types', { params });
    const raw = response.data;

    if (raw && Array.isArray(raw.data)) {
      return raw as DeviceTypeListResponse;
    }
    if (Array.isArray(raw)) {
      return {
        data: raw,
        meta: { page: params?.page ?? 1, limit: params?.limit ?? raw.length, total: raw.length, totalPages: 1 },
      };
    }
    return { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } };
  },

  /** Active device types only, sorted by sortOrder — used by Smart Repair intake */
  async getActive(): Promise<DeviceType[]> {
    const response = await api.get('/device-types/active');
    return response.data?.data || response.data || [];
  },

  async create(data: { name: string; code?: string; isActive?: boolean; sortOrder?: number }): Promise<DeviceType> {
    const response = await api.post('/device-types', data);
    return response.data?.data || response.data;
  },

  async update(id: string, data: { name?: string; isActive?: boolean; sortOrder?: number }): Promise<DeviceType> {
    const response = await api.put(`/device-types/${id}`, data);
    return response.data?.data || response.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/device-types/${id}`);
  },
};
