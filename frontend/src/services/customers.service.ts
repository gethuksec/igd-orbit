import { api, handleApiError } from './api';

export interface Customer {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  customerType: string;
  tier: {
    id: string;
    code: string;
    name: string;
    discountPercentage: number;
  } | null;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  isBlacklisted: boolean;
  isActive: boolean;
  preferredBranch?: {
    id: string;
    name: string;
    code: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListResponse {
  data: Customer[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const customersService = {
  async getStatistics(): Promise<{ total: number; goldPlatinum: number; regularSilver: number }> {
    try {
      const response = await api.get('/customers/statistics');
      return response.data;
    } catch (error: any) {
      return handleApiError(error, { total: 0, goldPlatinum: 0, regularSilver: 0 });
    }
  },

  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    tier?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<CustomerListResponse> {
    try {
      // Convert tier string to array format expected by backend
      const apiParams: any = {
        page: params?.page,
        limit: params?.limit,
        search: params?.search,
        sort: params?.sort || 'createdAt',
        order: params?.order || 'desc',
      };
      
      // Backend expects filter[tier] as array
      // NestJS uses format: filter[tier][]=REGULAR
      if (params?.tier && params.tier !== 'ALL') {
        // Use bracket notation for nested query params
        apiParams['filter[tier]'] = [params.tier];
      }
      
      const response = await api.get('/customers', { 
        params: apiParams,
        paramsSerializer: (params: any) => {
          const parts: string[] = [];
          Object.keys(params).forEach((key) => {
            const value = params[key];
            if (value !== undefined && value !== null && value !== '') {
              if (Array.isArray(value)) {
                // For arrays, use bracket notation: filter[tier][]=GOLD
                value.forEach((v) => {
                  parts.push(`${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`);
                });
              } else {
                parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
              }
            }
          });
          return parts.join('&');
        }
      });
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

  async getById(id: string): Promise<Customer> {
    try {
      const response = await api.get(`/customers/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<Customer> {
    const response = await api.post('/customers', data);
    return response.data.data || response.data;
  },

  async update(id: string, data: any): Promise<Customer> {
    const response = await api.put(`/customers/${id}`, data);
    return response.data.data || response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/customers/${id}`);
  },

  async import(file: File): Promise<{ success: number; updated: number; created: number; failed: number; errors: Array<{ row: number; error: string }> }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/customers/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async export(params?: { page?: number; limit?: number; search?: string }): Promise<void> {
    const apiParams: any = {
      page: params?.page,
      limit: params?.limit,
      search: params?.search,
    };
    
    const response = await api.get('/customers/export', {
      params: apiParams,
      responseType: 'blob',
    });
    
    // Create blob and download
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `customers-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

