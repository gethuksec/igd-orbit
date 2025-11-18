import { api } from './api';

export interface ServiceOrder {
  id: string;
  serviceNumber: string;
  customerId: string;
  // Snapshot fields for walk-in / inline customer data
  customerName?: string;
  customerPhone?: string;
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
    branchId?: string;
    technicianId?: string;
  }): Promise<ServiceOrderListResponse> {
    const response = await api.get('/service-orders', { params });
    const raw = response.data;

    // Backend currently returns a plain array (no pagination meta)
    if (Array.isArray(raw)) {
      const page = params?.page ?? 1;
      const limit = (params?.limit ?? raw.length) || 20;
      const total = raw.length;

      return {
        data: raw,
        meta: {
          page,
          limit,
          total,
          totalPages: 1,
        },
      };
    }

    // If backend later wraps with { data, meta }
    if (raw && Array.isArray(raw.data)) {
      return raw as ServiceOrderListResponse;
    }

    // Fallback defensive handling
    return {
      data: [],
      meta: {
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
        total: 0,
        totalPages: 1,
      },
    };
  },

  async getById(id: string): Promise<any> {
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

  async assignTechnician(id: string, payload: { technicianId: string; notes?: string }) {
    const response = await api.post(`/service-orders/${id}/assign`, payload);
    return response.data.data || response.data;
  },

  async updateStatus(id: string, payload: {
    status: string;
    notes?: string;
    photos?: string[];
    quotedPrice?: number;
    customerApprovedPrice?: number;
  }) {
    const response = await api.post(`/service-orders/${id}/status`, payload);
    return response.data.data || response.data;
  },

  async complete(id: string) {
    const response = await api.post(`/service-orders/${id}/complete`, {});
    return response.data.data || response.data;
  },

  async qcCheck(id: string, payload: { status: 'pass' | 'fail'; notes?: string; photos?: string[] }) {
    const response = await api.post(`/service-orders/${id}/qc`, payload);
    return response.data.data || response.data;
  },

  async deliver(id: string) {
    const response = await api.post(`/service-orders/${id}/deliver`, {});
    return response.data.data || response.data;
  },

  async addParts(id: string, payload: {
    parts: Array<{
      productId: string;
      quantity: number;
      unitCost: number;
      unitPrice: number;
      batchNumber?: string;
      serialNumber?: string;
      notes?: string;
    }>;
  }) {
    const response = await api.post(`/service-orders/${id}/parts`, payload);
    return response.data.data || response.data;
  },

  async removePart(id: string, partId: string) {
    const response = await api.delete(`/service-orders/${id}/parts/${partId}`);
    return response.data.data || response.data;
  },

  async processPayment(id: string, payload: {
    paymentMethod: 'cash' | 'transfer' | 'e_wallet' | 'credit_card' | 'debit_card';
    amount: number;
    reference?: string;
    notes?: string;
  }) {
    const response = await api.post(`/service-orders/${id}/payment`, payload);
    return response.data.data || response.data;
  },
};

