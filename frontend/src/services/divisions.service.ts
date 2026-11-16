import { api, handleApiError } from "./api";

export interface Division {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  department?: { id: string; code: string; name: string } | null;
  isActive: boolean;
  _count?: { employees: number; positions: number };
  createdAt: string;
  updatedAt: string;
}

export interface DivisionListResponse {
  data: Division[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
  total?: number;
}

export const divisionsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<DivisionListResponse> {
    try {
      const response = await api.get("/divisions", { params });
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

  async getById(id: string): Promise<Division> {
    const response = await api.get(`/divisions/${id}`);
    return response.data.data || response.data;
  },

  async create(data: any): Promise<Division> {
    const response = await api.post("/divisions", data);
    return response.data.data || response.data;
  },

  async update(id: string, data: any): Promise<Division> {
    const response = await api.put(`/divisions/${id}`, data);
    return response.data.data || response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/divisions/${id}`);
  },
};
