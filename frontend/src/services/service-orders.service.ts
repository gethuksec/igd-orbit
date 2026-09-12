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

  async addTime(id: string, payload: { serviceTypeId?: string; notes: string; newEstimatedAt: string }) {
    const response = await api.post(`/service-orders/${id}/add-time`, payload);
    return response.data.data || response.data;
  },

  // IGDERP-185: reveal lock credential (TC/HS/SPV; audit logged server-side)
  async revealLock(id: string) {
    const response = await api.get(`/service-orders/${id}/lock`);
    return response.data.data || response.data;
  },

  async addLayanan(id: string, payload: { serviceTypeId: string; notes?: string }) {
    const response = await api.post(`/service-orders/${id}/layanan`, payload);
    return response.data.data || response.data;
  },

  // IGDERP-137: final tag mapping per layanan row — Ready only
  async updateLayanan(id: string, rowId: string, payload: { notes?: string }) {
    const response = await api.patch(`/service-orders/${id}/layanan/${rowId}`, payload);
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
      warehouseId?: string;
      warrantyDays?: number;
    }>;
  }) {
    const response = await api.post(`/service-orders/${id}/parts`, payload);
    return response.data.data || response.data;
  },

  async removePart(id: string, partId: string) {
    const response = await api.delete(`/service-orders/${id}/parts/${partId}`);
    return response.data.data || response.data;
  },

  async removeLayanan(id: string, rowId: string) {
    const response = await api.delete(`/service-orders/${id}/layanan/${rowId}`);
    return response.data.data || response.data;
  },

  async uploadPhotoFiles(id: string, files: File[], photoType: string) {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    form.append('photoType', photoType);
    const response = await api.post(`/service-orders/${id}/photos/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data || response.data;
  },

  async processPayment(id: string, payload: {
    paymentMethod: 'cash' | 'transfer' | 'qris' | 'e_wallet' | 'credit_card' | 'debit_card';
    amount: number;
    reference?: string;
    notes?: string;
  }) {
    const response = await api.post(`/service-orders/${id}/payment`, payload);
    return response.data.data || response.data;
  },

  // IGDERP-171: void mistaken payment (approver asserted server-side)
  async voidPayment(id: string, payload: { reason: string }) {
    const response = await api.post(`/service-orders/${id}/payment/void`, payload);
    return response.data.data || response.data;
  },

  /** Smart Repair (E-FE): create with tax flags, completeness items, parts, cost breakdown */
  async createSmartRepair(data: import('@/types/service').SmartRepairPayload): Promise<any> {
    const response = await api.post('/service-orders', data);
    return response.data?.data || response.data;
  },
};

