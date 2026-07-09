import { api, handleApiError } from "./api";

export interface Expedition {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpeditionListResponse {
  data: Expedition[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const expeditionsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    "filter[isActive]"?: boolean;
  }): Promise<ExpeditionListResponse> {
    try {
      const response = await api.get("/expeditions", { params });
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

  async getById(id: string): Promise<Expedition> {
    try {
      const response = await api.get(`/expeditions/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<Expedition> {
    try {
      const response = await api.post("/expeditions", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<Expedition> {
    try {
      const response = await api.put(`/expeditions/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/expeditions/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};
