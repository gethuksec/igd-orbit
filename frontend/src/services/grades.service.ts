import { api, handleApiError } from "./api";

export interface Grade {
  id: string;
  code: string;
  name: string;
  rank: number;
  isActive: boolean;
  _count?: { positions: number };
  createdAt: string;
  updatedAt: string;
}

export interface GradeListResponse {
  data: Grade[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
  total?: number;
}

export const gradesService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<GradeListResponse> {
    try {
      const response = await api.get("/grades", { params });
      const body = response.data;
      if (Array.isArray(body?.data)) return body;
      return {
        data: body?.data ?? [],
        meta: body?.meta ?? { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
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

  async getById(id: string): Promise<Grade> {
    const response = await api.get(`/grades/${id}`);
    return response.data.data || response.data;
  },

  async create(data: any): Promise<Grade> {
    const response = await api.post("/grades", data);
    return response.data.data || response.data;
  },

  async update(id: string, data: any): Promise<Grade> {
    const response = await api.put(`/grades/${id}`, data);
    return response.data.data || response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/grades/${id}`);
  },
};
