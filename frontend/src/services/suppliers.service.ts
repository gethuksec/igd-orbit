import { api, handleApiError } from './api';

export interface Supplier {
  id: string;
  customerCode: string;
  code?: string; // Legacy field
  name: string;
  phone: string;
  email?: string;
  address?: string;
  customerType: string; // Always 'wholesale' for suppliers
  tier: {
    id: string;
    code: string;
    name: string;
    discountPercentage: number;
  } | null;
  creditLimit: number;
  creditUsed?: number;
  creditAvailable?: number;
  isBlacklisted?: boolean;
  isActive: boolean;
  preferredBranch?: {
    id: string;
    name: string;
    code: string;
  } | null;
  contactPerson?: string;
  alternatePhone?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  dateOfBirth?: string;
  gender?: string;
  religion?: string;
  idType?: string;
  idNumber?: string;
  taxId?: string;
  taxName?: string;
  taxIdType?: string;
  taxAddress?: string;
  idTKU?: string;
  taxTransactionDetail?: string;
  creditLimitNoteCount?: number;
  paymentTermDays?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierListResponse {
  data: Supplier[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const suppliersService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    status?: 'active' | 'inactive';
  }): Promise<SupplierListResponse> {
    try {
      const apiParams: any = {
        page: params?.page,
        limit: params?.limit,
        search: params?.search,
        sort: params?.sort || 'createdAt',
        order: params?.order || 'desc',
      };
      
      if (params?.status) {
        apiParams['filter[isActive]'] = params.status === 'active';
      }
      
      const response = await api.get('/suppliers', { params: apiParams });
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

  async getById(id: string): Promise<Supplier> {
    try {
      const response = await api.get(`/suppliers/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<Supplier> {
    try {
      const response = await api.post('/suppliers', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<Supplier> {
    try {
      const response = await api.put(`/suppliers/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/suppliers/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};

