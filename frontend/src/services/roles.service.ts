import { api, handleApiError } from './api';

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  level: number;
  isSystemRole: boolean;
  isActive: boolean;
  defaultPermissions?: string[];
  userCount?: number; // Number of users with this role
  createdAt: string;
  updatedAt: string;
}

export interface RoleListResponse {
  data: Role[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateRoleDto {
  code: string;
  name: string;
  description?: string;
  level: number;
  isSystemRole?: boolean;
  defaultPermissions?: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  level?: number;
  isActive?: boolean;
  parentRoleId?: string | null;
  defaultPermissions?: string[];
}

export const rolesService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
    isActive?: boolean;
  }): Promise<RoleListResponse> {
    try {
      const response = await api.get('/roles', { params });
      // Backend returns: { data: Role[], meta: { page, limit, total, totalPages } }
      if (response.data && response.data.data) {
        return response.data;
      }
      // Fallback: wrap if needed
      return {
        data: Array.isArray(response.data) ? response.data : [],
        meta: response.data?.meta || { page: 1, limit: 20, total: 0, totalPages: 0 },
      };
    } catch (error: any) {
      return handleApiError(error, { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    }
  },

  async getById(id: string): Promise<Role> {
    try {
      const response = await api.get(`/roles/${id}`);
      return response.data;
    } catch (error: any) {
      handleApiError(error, {} as Role);
      throw error;
    }
  },

  async create(data: CreateRoleDto): Promise<Role> {
    try {
      const response = await api.post('/roles', data);
      return response.data;
    } catch (error: any) {
      handleApiError(error, {} as Role);
      throw error;
    }
  },

  async update(id: string, data: UpdateRoleDto): Promise<Role> {
    try {
      const response = await api.put(`/roles/${id}`, data);
      return response.data;
    } catch (error: any) {
      handleApiError(error, {} as Role);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/roles/${id}`);
    } catch (error: any) {
      handleApiError(error, undefined);
      throw error;
    }
  },

  async clone(roleId: string, data: { code: string; name: string }): Promise<Role> {
    try {
      const response = await api.post(`/roles/${roleId}/clone`, data);
      return response.data;
    } catch (error: any) {
      handleApiError(error, {} as Role);
      throw error;
    }
  },
};
