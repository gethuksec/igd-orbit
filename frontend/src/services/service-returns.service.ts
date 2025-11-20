import { api } from './api';

export interface ServiceReturn {
  id: string;
  returnNumber: string;
  serviceOrderId: string;
  returnType: 're-service' | 'complaint' | 'warranty' | 'combination';
  returnReason: string;
  customerComplaint?: string;
  isWithinWarranty: boolean;
  isWithinReturnPeriod: boolean;
  status: 'pending' | 'investigating' | 'approved' | 'rejected' | 'resolved';
  resolution?: string;
  resolutionType?: 're-service' | 'refund' | 'discount' | 'replacement';
  newServiceOrderId?: string;
  refundAmount?: number;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  returnedAt: string;
  resolvedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  serviceOrder?: {
    id: string;
    serviceNumber: string;
    customerId?: string | null;
    customerName: string;
    customerPhone: string;
    deviceType: string;
    deviceBrand?: string;
    deviceModel?: string;
    deliveredAt?: string;
    warrantyDays: number;
    customer?: {
      id: string;
      name: string;
      phone: string;
    } | null;
    branch?: {
      id: string;
      name: string;
      code: string;
    };
  };
  newServiceOrder?: {
    id: string;
    serviceNumber: string;
    customerName: string;
    status: string;
  };
}

export interface ServiceReturnListResponse {
  data: ServiceReturn[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateServiceReturnDto {
  serviceOrderId: string;
  returnType: 're-service' | 'complaint' | 'warranty' | 'combination';
  returnReason: string;
  customerComplaint?: string;
  isWithinWarranty?: boolean;
  isWithinReturnPeriod?: boolean;
}

export interface UpdateServiceReturnDto {
  returnType?: 're-service' | 'complaint' | 'warranty' | 'combination';
  returnReason?: string;
  customerComplaint?: string;
  isWithinWarranty?: boolean;
  isWithinReturnPeriod?: boolean;
}

export interface ApproveServiceReturnDto {
  resolutionType: 're-service' | 'refund' | 'discount' | 'replacement';
  resolution: string;
  refundAmount?: number;
}

export interface RejectServiceReturnDto {
  rejectionReason: string;
}

export interface CreateReServiceDto {
  serviceTypeId?: string;
  priority?: 'normal' | 'urgent';
  notes?: string;
}

export const serviceReturnsService = {
  async create(data: CreateServiceReturnDto): Promise<ServiceReturn> {
    const response = await api.post('/service-returns', data);
    return response.data;
  },

  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    returnType?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<ServiceReturnListResponse> {
    const response = await api.get('/service-returns', { params });
    const raw = response.data;

    // Backend returns paginated response
    if (raw.data && raw.meta) {
      return raw;
    }

    // Fallback for non-paginated response
    const page = params?.page ?? 1;
    const limit = (params?.limit ?? (Array.isArray(raw) ? raw.length : 20)) || 20;
    const total = Array.isArray(raw) ? raw.length : 0;

    return {
      data: Array.isArray(raw) ? raw : [],
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getById(id: string): Promise<ServiceReturn> {
    const response = await api.get(`/service-returns/${id}`);
    return response.data;
  },

  async update(id: string, data: UpdateServiceReturnDto): Promise<ServiceReturn> {
    const response = await api.put(`/service-returns/${id}`, data);
    return response.data;
  },

  async approve(id: string, data: ApproveServiceReturnDto): Promise<ServiceReturn> {
    const response = await api.post(`/service-returns/${id}/approve`, data);
    return response.data;
  },

  async reject(id: string, data: RejectServiceReturnDto): Promise<ServiceReturn> {
    const response = await api.post(`/service-returns/${id}/reject`, data);
    return response.data;
  },

  async createReService(id: string, data: CreateReServiceDto): Promise<ServiceReturn> {
    const response = await api.post(`/service-returns/${id}/re-service`, data);
    return response.data;
  },

  async resolve(id: string): Promise<ServiceReturn> {
    const response = await api.post(`/service-returns/${id}/resolve`);
    return response.data;
  },
};

