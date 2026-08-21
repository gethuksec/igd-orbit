import { api, handleApiError } from "./api";

export type WarehouseType = "GOOD" | "BAD";
export type WarehouseScope = "OUTLET" | "SYSTEM";

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  contactPerson?: string | null;
  mobilePhone?: string | null;
  isActive: boolean;
  type: WarehouseType;
  scope: WarehouseScope;
  outletId?: string | null;
  outlet?: {
    id: string;
    code: string;
    name: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseInput {
  name: string;
  code?: string;
  type?: WarehouseType;
  scope?: WarehouseScope;
  outletId?: string | null;
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  mobilePhone?: string;
  isActive?: boolean;
}

export interface WarehouseListResponse {
  data: Warehouse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const warehousesService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    includeInactive?: boolean;
    status?: string;
    outletId?: string;
    type?: WarehouseType;
    scope?: WarehouseScope;
  }): Promise<WarehouseListResponse> {
    try {
      const response = await api.get("/warehouses", { params });
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

  async getById(id: string): Promise<Warehouse> {
    try {
      const response = await api.get(`/warehouses/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async create(data: WarehouseInput): Promise<Warehouse> {
    try {
      const response = await api.post("/warehouses", data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async update(id: string, data: Partial<WarehouseInput>): Promise<Warehouse> {
    try {
      const response = await api.put(`/warehouses/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getActive(params?: {
    outletId?: string;
    includeSystem?: boolean;
  }): Promise<Pick<Warehouse, "id" | "code" | "name" | "outletId" | "type" | "scope">[]> {
    const response = await api.get("/warehouses/active", { params });
    return response.data.data || response.data;
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/warehouses/${id}`);
    } catch (error: any) {
      throw error;
    }
  },
};
