import { api, handleApiError } from "./api";

export interface PayrollComponent {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: 'earning' | 'deduction';
  source: 'fixed' | 'grade' | 'computed' | 'manual';
  defaultAmount?: number | null;
  tiers?: any;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollComponentListResponse {
  data: PayrollComponent[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const payrollComponentsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    includeInactive?: boolean;
    status?: string;
    category?: string;
  }): Promise<PayrollComponentListResponse> {
    try {
      const response = await api.get("/payroll-components", { params });
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

  async getById(id: string): Promise<PayrollComponent> {
    try {
      const response = await api.get(`/payroll-components/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<PayrollComponent> {
    try {
      const response = await api.post("/payroll-components", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<PayrollComponent> {
    try {
      const response = await api.put(`/payroll-components/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/payroll-components/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};
