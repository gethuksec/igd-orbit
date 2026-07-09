import { api, handleApiError } from "./api";

export interface Size {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SizeListResponse {
  data: Size[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const sizesService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    "filter[isActive]"?: boolean;
  }): Promise<SizeListResponse> {
    try {
      const response = await api.get("/sizes", { params });
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

  async getById(id: string): Promise<Size> {
    try {
      const response = await api.get(`/sizes/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<Size> {
    try {
      const response = await api.post("/sizes", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<Size> {
    try {
      const response = await api.put(`/sizes/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/sizes/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};
