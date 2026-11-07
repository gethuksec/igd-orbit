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

// ── XLSX import (3-step: template → preview → confirm). Files are parsed
// in memory server-side and never stored. ──
export type CustomerDuplicateMode = 'overwrite' | 'skip';

export interface CustomerImportPreviewRow {
  rowNumber: number;
  rowNumbers?: number[];
  customerCode?: string;
  name?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  customerType: string;
  notes?: string;
  isUpdate: boolean;
  errors: string[];
}

export interface CustomerImportPreview {
  rows: CustomerImportPreviewRow[];
  validCount: number;
  errorCount: number;
}

export interface CustomerImportResult {
  created: number;
  updated: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
  customerIds: string[];
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
    type?: string;
    status?: string;
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
      
      // Customer type filter (retail/wholesale/corporate) — single value (app-wide convention)
      if (params?.type) {
        apiParams['filter[type]'] = params.type;
      }
      
      // Status filter (active = not deleted, inactive = soft-deleted)
      if (params?.status) {
        apiParams['filter[status]'] = params.status;
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

  // ── XLSX import: template → preview (read-only) → confirm (writes) ──
  async downloadCustomerImportTemplate(): Promise<Blob> {
    const response = await api.get('/customers/import/template', { responseType: 'blob' });
    return response.data;
  },

  async previewCustomerImport(file: File): Promise<CustomerImportPreview> {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post('/customers/import/preview', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async confirmCustomerImport(payload: {
    fileName: string;
    rows: Array<{
      rowNumbers: number[];
      customerCode?: string;
      name: string;
      phone: string;
      address?: string;
      dateOfBirth?: string;
      gender?: string;
      customerType?: string;
      notes?: string;
    }>;
    duplicateMode: CustomerDuplicateMode;
  }): Promise<CustomerImportResult> {
    const response = await api.post('/customers/import/confirm', payload);
    return response.data;
  },
};

