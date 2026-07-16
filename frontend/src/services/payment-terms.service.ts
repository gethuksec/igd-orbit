import { api, handleApiError } from "./api";

export interface PaymentTerm {
  id: string;
  code: string;
  name: string;
  days: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentTermListResponse {
  data: PaymentTerm[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const paymentTermsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    includeInactive?: boolean;
    status?: string;
  }): Promise<PaymentTermListResponse> {
    try {
      const response = await api.get("/payment-terms", { params });
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

  async getById(id: string): Promise<PaymentTerm> {
    try {
      const response = await api.get(`/payment-terms/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<PaymentTerm> {
    try {
      const response = await api.post("/payment-terms", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<PaymentTerm> {
    try {
      const response = await api.put(`/payment-terms/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/payment-terms/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};
