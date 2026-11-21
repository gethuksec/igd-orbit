import { api, handleApiError } from "./api";

export interface LiburQuotaRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  quotaDays: number;
  quotaSource: "global" | "khusus";
  used: number;
  pending: number;
  remaining: number;
  overQuotaDays: number;
  isOverQuota: boolean;
}

export interface LiburQuotasResponse {
  data: LiburQuotaRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
  globalQuotaDays: number;
  period: string;
}

export interface LiburRequest {
  id: string;
  employeeId: string;
  date: string;
  targetPeriod: string;
  kind: "current" | "advance";
  status: "pending" | "approved" | "rejected" | "cancelled";
  atasanStatus?: "pending" | "approved" | "rejected";
  atasanDecidedBy?: string | null;
  atasanDecidedAt?: string | null;
  atasanRejectReason?: string | null;
  requestedBy: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  rejectReason?: string | null;
  consecutiveWarning?: string[];
  overQuota?: boolean;
  employee?: {
    id: string;
    employeeCode: string;
    user?: { fullName?: string };
  };
}

export interface LiburRequestsResponse {
  data: LiburRequest[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const fallbackQuotas = (page = 1, limit = 20, period = ""): LiburQuotasResponse => ({
  data: [],
  meta: { page, limit, total: 0, totalPages: 0 },
  globalQuotaDays: 4,
  period,
});

export const liburService = {
  async getQuotas(params?: {
    period?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<LiburQuotasResponse> {
    try {
      const response = await api.get("/libur/quotas", { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(
        error,
        fallbackQuotas(params?.page, params?.limit, params?.period || "")
      );
    }
  },

  async setGlobalQuota(quotaDays: number): Promise<{ quotaDays: number }> {
    try {
      const response = await api.put("/libur/quotas/global", { quotaDays });
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async setEmployeeQuota(
    employeeId: string,
    quotaDays: number | null
  ): Promise<void> {
    try {
      await api.put(`/libur/quotas/${employeeId}`, { quotaDays });
    } catch (error: any) {
      throw error;
    }
  },

  async getRequests(params?: {
    period?: string;
    status?: string;
    kind?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<LiburRequestsResponse> {
    try {
      const response = await api.get("/libur/requests", { params });
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

  async createRequest(data: {
    employeeId: string;
    date: string;
  }): Promise<LiburRequest> {
    try {
      const response = await api.post("/libur/requests", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async approveRequest(id: string): Promise<LiburRequest> {
    try {
      const response = await api.post(`/libur/requests/${id}/approve`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async rejectRequest(id: string, reason?: string): Promise<LiburRequest> {
    try {
      const response = await api.post(`/libur/requests/${id}/reject`, {
        reason,
      });
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async cancelRequest(id: string): Promise<LiburRequest> {
    try {
      const response = await api.post(`/libur/requests/${id}/cancel`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // IGDERP-265 gaps: two-step approval (Q5) + tick-to-bulk
  async atasanApprove(id: string): Promise<LiburRequest> {
    try {
      const response = await api.post(`/libur/requests/${id}/atasan-approve`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async atasanReject(id: string, reason?: string): Promise<LiburRequest> {
    try {
      const response = await api.post(`/libur/requests/${id}/atasan-reject`, { reason });
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async bulkApprove(ids: string[]): Promise<{ approved: LiburRequest[]; failed: { id: string; reason: string }[] }> {
    try {
      const response = await api.post("/libur/requests/bulk-approve", { ids });
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async bulkReject(ids: string[], reason?: string): Promise<{ rejected: LiburRequest[]; failed: { id: string; reason: string }[] }> {
    try {
      const response = await api.post("/libur/requests/bulk-reject", { ids, reason });
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },
};
