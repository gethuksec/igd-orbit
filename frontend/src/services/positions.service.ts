import { api, handleApiError } from "./api";

export interface Position {
  id: string;
  code: string;
  name: string;
  rank: number;
  divisionId: string | null;
  departmentId: string | null;
  gradeId: string | null;
  minSalary: number | null;
  defaultRoleId: string | null;
  defaultShiftId?: string | null;
  defaultShift?: { id: string; code: string; name: string } | null;
  division?: { id: string; code: string; name: string } | null;
  department?: { id: string; code: string; name: string } | null;
  grade?: { id: string; code: string; name: string; rank: number } | null;
  defaultRole?: { id: string; code: string; name: string } | null;
  isActive: boolean;
  _count?: { employees: number };
  createdAt: string;
  updatedAt: string;
}

export interface PositionListResponse {
  data: Position[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
  total?: number;
}

export const positionsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    rank?: number;
  }): Promise<PositionListResponse> {
    try {
      const response = await api.get("/positions", { params });
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

  async getById(id: string): Promise<Position> {
    const response = await api.get(`/positions/${id}`);
    return response.data.data || response.data;
  },

  async create(data: any): Promise<Position> {
    const response = await api.post("/positions", data);
    return response.data.data || response.data;
  },

  async update(id: string, data: any): Promise<Position> {
    const response = await api.put(`/positions/${id}`, data);
    return response.data.data || response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/positions/${id}`);
  },
};
