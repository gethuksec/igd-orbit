import { api, handleApiError } from "./api";

export interface CustomerType {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerTypeListResponse {
  data: CustomerType[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const customerTypesService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    includeInactive?: boolean;
    status?: string;
  }): Promise<CustomerTypeListResponse> {
    try {
      const response = await api.get("/customer-types", { params });
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

  async getById(id: string): Promise<CustomerType> {
    try {
      const response = await api.get(`/customer-types/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<CustomerType> {
    try {
      const response = await api.post("/customer-types", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<CustomerType> {
    try {
      const response = await api.put(`/customer-types/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/customer-types/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};
