import { api, handleApiError } from "./api";

export interface SalesType {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SalesTypeListResponse {
  data: SalesType[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const salesTypesService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    "filter[isActive]"?: boolean;
  }): Promise<SalesTypeListResponse> {
    try {
      const response = await api.get("/sales-types", { params });
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

  async getById(id: string): Promise<SalesType> {
    try {
      const response = await api.get(`/sales-types/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<SalesType> {
    try {
      const response = await api.post("/sales-types", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<SalesType> {
    try {
      const response = await api.put(`/sales-types/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/sales-types/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};
