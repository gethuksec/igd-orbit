import { api } from './api';

export interface ServiceOrder {
  id: string;
  serviceNumber: string;
  customerId: string;
  customer?: { id: string; name: string; phone: string };
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceOrderListResponse {
  data: ServiceOrder[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const serviceOrdersService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<ServiceOrderListResponse> {
    const response = await api.get('/service-orders', { params });
    return response.data;
  },

  async getById(id: string): Promise<ServiceOrder> {
    const response = await api.get(`/service-orders/${id}`);
    return response.data.data || response.data;
  },

  async create(data: any): Promise<ServiceOrder> {
    const response = await api.post('/service-orders', data);
    return response.data.data || response.data;
  },

  async update(id: string, data: any): Promise<ServiceOrder> {
    const response = await api.put(`/service-orders/${id}`, data);
    return response.data.data || response.data;
  },
};

