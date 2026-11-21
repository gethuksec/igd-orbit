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

export interface ShiftSetting {
  id?: string;
  rosterOpenDay: number;
  rosterCloseDay: number | null;
  employeeInputStartDay: number;
  configured?: boolean;
}

export interface ShiftResolveResult {
  shift: Shift | null;
  source: "roster" | "roster-libur" | "assignment" | "employee-default" | "title-default" | "exempt" | "none";
}

export interface RosterEmployee {
  id: string;
  employeeCode: string;
  fullName: string | null;
  department: { id: string; name: string } | null;
  division: { id: string; name: string } | null;
}

export interface RosterRow {
  employee: RosterEmployee;
  status: "TERJADWAL" | "BELUM";
  plotted: number;
  libur: number;
  empty: number;
  dominantShift: string | null;
}

export interface RosterListResponse {
  data: RosterRow[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface RosterEntryView {
  date: string;
  shiftId: string | null;
  shiftCode: string | null;
  submitted: boolean;
}

export interface DivisionOverlay {
  divisionId: string;
  employees: { id: string; employeeCode: string; fullName: string | null }[];
  entries: { employeeId: string; date: string; shiftId: string | null; shiftCode: string | null }[];
}

export interface AssignContext {
  employee: {
    id: string;
    employeeCode: string;
    departmentId?: string | null;
    divisionId?: string | null;
    department?: { id: string; name: string } | null;
    division?: { id: string; name: string } | null;
    user?: { fullName?: string } | null;
  };
  entries: RosterEntryView[];
  overlay: DivisionOverlay | null;
}

export const rosterService = {
  async getRoster(params: {
    start: string;
    end: string;
    status?: string;
    departmentIds?: string[];
    divisionIds?: string[];
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<RosterListResponse> {
    try {
      const response = await api.get("/shift-roster", {
        params: {
          ...params,
          departmentIds: params.departmentIds?.join(",") || undefined,
          divisionIds: params.divisionIds?.join(",") || undefined,
        },
      });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { total: 0, page: params.page || 1, limit: params.limit || 20, totalPages: 0 },
      });
    }
  },

  async getAssignContext(employeeId: string, start: string, end: string): Promise<AssignContext | null> {
    try {
      const response = await api.get(`/shift-roster/assign/${employeeId}`, { params: { start, end } });
      return response.data?.data ?? response.data;
    } catch (error: any) {
      handleApiError(error, null);
      return null;
    }
  },

  async submitRoster(data: {
    employeeId: string;
    start: string;
    end: string;
    entries: { date: string; shiftId: string | null }[];
  }): Promise<{ employeeId: string; submitted: number; start: string; end: string }> {
    try {
      const response = await api.post("/shift-roster/submit", data);
      return response.data?.data ?? response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

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

  // IGDERP-265 v2: roster input window (release = roster submitted flag)
  async getSetting(): Promise<ShiftSetting> {
    try {
      const response = await api.get("/shifts/settings/current");
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async updateSetting(data: Partial<ShiftSetting>): Promise<ShiftSetting> {
    try {
      const response = await api.put("/shifts/settings", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async resolveShift(employeeId: string, date: string): Promise<ShiftResolveResult> {
    try {
      const response = await api.get("/shifts/current", { params: { employeeId, date } });
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },
};
