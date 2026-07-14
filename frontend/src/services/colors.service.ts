import { api, handleApiError } from "./api";

export interface Color {
  id: string;
  code: string;
  name: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ColorListResponse {
  data: Color[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const colorsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    "filter[isActive]"?: boolean;
  }): Promise<ColorListResponse> {
    try {
      const response = await api.get("/colors", { params });
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

  async getById(id: string): Promise<Color> {
    try {
      const response = await api.get(`/colors/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<Color> {
    try {
      const response = await api.post("/colors", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<Color> {
    try {
      const response = await api.put(`/colors/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/colors/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};
