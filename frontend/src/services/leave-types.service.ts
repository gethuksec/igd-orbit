import { api, handleApiError } from "./api";

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  description?: string;
  isPaid: boolean;
  quotaDays: number;
  maxApplyDelayDays?: number | null;
  maxRequestsPerMonth?: number | null;
  minTenureMonths?: number | null;
  requiresAttachment: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveTypeListResponse {
  data: LeaveType[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const leaveTypesService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    includeInactive?: boolean;
    status?: string;
  }): Promise<LeaveTypeListResponse> {
    try {
      const response = await api.get("/leave-types", { params });
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

  async getById(id: string): Promise<LeaveType> {
    try {
      const response = await api.get(`/leave-types/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: any): Promise<LeaveType> {
    try {
      const response = await api.post("/leave-types", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<LeaveType> {
    try {
      const response = await api.put(`/leave-types/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/leave-types/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};
