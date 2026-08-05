import { api, handleApiError } from './api';

export interface Branch {
  id: string;
  code: string;
  name: string;
  group?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  province?: string;
  director?: string;
  contactPerson?: string;
  mobilePhone?: string;
  headOfServiceId?: string;
  headOfService?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
  isActive: boolean;
  operatingHours?: Record<string, any>;
  userCount?: number;
  productStockCount?: number;
  salesTransactionCount?: number;
  serviceOrderCount?: number;
  stockMovementCount?: number;
  stockTransferFromCount?: number;
  stockTransferToCount?: number;
  stockOpnameCount?: number;
  employeeCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface BranchListResponse {
  data: Branch[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const branchesService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    includeInactive?: boolean;
    status?: string;
  }): Promise<BranchListResponse> {
    try {
      const { status, ...rest } = params || {};
      const queryParams: any = { ...rest };
      if (status && status !== 'all') {
        queryParams.includeInactive = status === 'inactive';
      }
      const response = await api.get('/branches/list', { params: queryParams });
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

  async getById(id: string): Promise<Branch> {
    try {
      const response = await api.get(`/branches/${id}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<Branch> {
    try {
      const response = await api.post('/branches', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<Branch> {
    try {
      const response = await api.put(`/branches/${id}`, data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/branches/${id}`);
    } catch (error: any) {
      throw error;
    }
  },

  async getDetailedStats(id: string): Promise<any> {
    try {
      const response = await api.get(`/branches/${id}/stats`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getHSUsers(): Promise<Array<{ id: string; name: string; email: string; phone?: string }>> {
    try {
      const response = await api.get('/branches/hs-users/list');
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

