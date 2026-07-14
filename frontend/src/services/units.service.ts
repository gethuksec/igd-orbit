import { api, handleApiError } from "./api";

export interface Unit {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UnitListResponse {
  data: Unit[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const unitsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    includeInactive?: boolean;
    status?: string;
  }): Promise<UnitListResponse> {
    try {
      const response = await api.get("/units", { params });
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

  async getById(id: string): Promise<Unit> {
    try {
      const response = await api.get(`/units/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<Unit> {
    try {
      const response = await api.post("/units", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<Unit> {
    try {
      const response = await api.put(`/units/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/units/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};
