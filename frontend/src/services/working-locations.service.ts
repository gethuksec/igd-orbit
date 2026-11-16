import { api, handleApiError } from "./api";

export interface WorkingLocation {
  id: string;
  code: string;
  name: string;
  address: string | null;
  branchId: string | null;
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
  isActive: boolean;
  branch?: { id: string; code: string; name: string } | null;
  _count?: { contracts: number };
  createdAt: string;
  updatedAt: string;
}

export interface WorkingLocationListResponse {
  data: WorkingLocation[];
  meta?: { page: number; limit: number; total: number; totalPages: number };
  total?: number;
}

export const workingLocationsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<WorkingLocationListResponse> {
    try {
      const response = await api.get("/working-locations", { params });
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

  async getById(id: string): Promise<WorkingLocation> {
    const response = await api.get(`/working-locations/${id}`);
    return response.data.data || response.data;
  },

  async create(payload: Partial<WorkingLocation>) {
    const response = await api.post("/working-locations", payload);
    return response.data.data || response.data;
  },

  async update(id: string, payload: Partial<WorkingLocation>) {
    const response = await api.put(`/working-locations/${id}`, payload);
    return response.data.data || response.data;
  },

  async remove(id: string) {
    await api.delete(`/working-locations/${id}`);
  },
};
