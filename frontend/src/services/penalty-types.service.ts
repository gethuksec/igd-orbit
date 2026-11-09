import { api, handleApiError } from "./api";

export interface PenaltyType {
  id: string;
  code: string;
  name: string;
  description?: string;
  calculation: 'fixed' | 'percent-tier' | 'flexible';
  defaultAmount?: number | null;
  tiers?: any;
  priority: number;
  picScoped: boolean;
  approverRole: string;
  linksHolidayWork: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PenaltyTypeListResponse {
  data: PenaltyType[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const penaltyTypesService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    includeInactive?: boolean;
    status?: string;
  }): Promise<PenaltyTypeListResponse> {
    try {
      const response = await api.get("/penalty-types", { params });
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

  async getById(id: string): Promise<PenaltyType> {
    try {
      const response = await api.get(`/penalty-types/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<PenaltyType> {
    try {
      const response = await api.post("/penalty-types", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<PenaltyType> {
    try {
      const response = await api.put(`/penalty-types/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/penalty-types/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};
