import { api, handleApiError } from "./api";

export interface Shift {
  id: string;
  code: string;
  name: string;
  clockIn: string;
  clockOut: string;
  overnight: boolean;
  lateToleranceMin: number;
  breakHours?: number | null;
  color?: string | null;
  isActive: boolean;
  activeAssignmentsCount?: number;
}

export interface ShiftListResponse {
  data: Shift[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  shiftId: string;
  startDate: string;
  endDate?: string | null;
  weekdays: number[];
  offDates?: string[];
  note?: string | null;
  employee?: {
    id: string;
    employeeCode: string;
    division?: { name?: string } | null;
    user?: { fullName?: string };
  };
  shift?: Shift;
}

export interface ShiftAssignmentListResponse {
  data: ShiftAssignment[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export const WEEKDAY_LABELS = ["S", "S", "R", "K", "J", "S", "M"];

export const shiftsService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<ShiftListResponse> {
    try {
      const response = await api.get("/shifts", { params });
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

  async create(data: any): Promise<Shift> {
    try {
      const response = await api.post("/shifts", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: any): Promise<Shift> {
    try {
      const response = await api.put(`/shifts/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/shifts/${id}`);
    } catch (error: any) {
      throw error;
    }
  },

  async getAssignments(params?: {
    employeeId?: string;
    shiftId?: string;
    activeOn?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ShiftAssignmentListResponse> {
    try {
      const response = await api.get("/shift-assignments", { params });
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

  async createAssignment(data: any): Promise<ShiftAssignment> {
    try {
      const response = await api.post("/shift-assignments", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async updateAssignment(id: string, data: any): Promise<ShiftAssignment> {
    try {
      const response = await api.put(`/shift-assignments/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async deleteAssignment(id: string): Promise<void> {
    try {
      await api.delete(`/shift-assignments/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};
