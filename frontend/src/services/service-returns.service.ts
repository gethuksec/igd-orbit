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
  createdAt: string;
  updatedAt: string;
  serviceOrder?: {
    id: string;
    serviceNumber: string;
    customerName: string;
    deviceType: string;
    deviceBrand?: string;
    deviceModel?: string;
    deliveredAt?: string;
    warrantyDays: number;
    branch?: {
      id: string;
      name: string;
      code: string;
    };
    customer?: {
      id: string;
      name: string;
      customerCode?: string;
    };
  };
  newServiceOrder?: {
    id: string;
    serviceNumber: string;
    status: string;
    priority: string;
  };
}

export interface ServiceReturnListResponse {
  data: ServiceReturn[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateServiceReturnDto {
  serviceOrderId: string;
  returnType: 're-service' | 'complaint' | 'warranty' | 'combination';
  returnReason: string;
  customerComplaint?: string;
  expectedResolution?: 're-service' | 'refund' | 'discount' | 'replacement';
  expectedRefundAmount?: number;
  returnedAt?: string;
}

export interface UpdateServiceReturnDto {
  returnReason?: string;
  customerComplaint?: string;
  resolution?: string;
  resolutionType?: 're-service' | 'refund' | 'discount' | 'replacement';
  refundAmount?: number;
}

export interface ApproveServiceReturnDto {
  resolution?: string;
  resolutionType?: 're-service' | 'refund' | 'discount' | 'replacement';
  notes?: string;
}

export interface RejectServiceReturnDto {
  rejectionReason: string;
}

export interface CreateReServiceDto {
  assignedTechnicianId?: string;
  promisedDate?: string;
  notes?: string;
}

export const serviceReturnsService = {
  async create(dto: CreateServiceReturnDto): Promise<ServiceReturn> {
    const response = await api.post('/service-returns', dto);
    return response.data;
  },

  async getAll(params?: {
    page?: number;
    limit?: number;
    status?: string;
    returnType?: string;
    branchId?: string;
    search?: string;
  }): Promise<ServiceReturnListResponse> {
    const response = await api.get('/service-returns', { params });
    return response.data;
  },

  async getById(id: string): Promise<ServiceReturn> {
    const response = await api.get(`/service-returns/${id}`);
    return response.data;
  },

  async update(id: string, dto: UpdateServiceReturnDto): Promise<ServiceReturn> {
    const response = await api.put(`/service-returns/${id}`, dto);
    return response.data;
  },

  async approve(id: string, dto: ApproveServiceReturnDto): Promise<ServiceReturn> {
    const response = await api.post(`/service-returns/${id}/approve`, dto);
    return response.data;
  },

  async reject(id: string, dto: RejectServiceReturnDto): Promise<ServiceReturn> {
    const response = await api.post(`/service-returns/${id}/reject`, dto);
    return response.data;
  },

  async createReService(id: string, dto: CreateReServiceDto): Promise<ServiceReturn> {
    const response = await api.post(`/service-returns/${id}/re-service`, dto);
    return response.data;
  },

  async resolve(id: string): Promise<ServiceReturn> {
    const response = await api.post(`/service-returns/${id}/resolve`);
    return response.data;
  },
};

