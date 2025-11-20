import { api, handleApiError } from './api';

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  permissions?: Permission[];
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: string;
  submodule: string;
  action: string;
  description?: string;
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
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface AssignPermissionDto {
  permissionId: string;
}

export interface PermissionGroup {
  module: string;
  submodules: {
    submodule: string;
    permissions: Permission[];
  }[];
}

export const rolesService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<RoleListResponse> {
    try {
      const response = await api.get('/roles', { params });
      return response.data;
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

  async getPermissions(id: string): Promise<Permission[]> {
    try {
      const response = await api.get(`/roles/${id}/permissions`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async assignPermission(roleId: string, permissionId: string): Promise<void> {
    try {
      await api.post(`/roles/${roleId}/permissions`, { permissionId });
    } catch (error: any) {
      handleApiError(error, undefined);
      throw error;
    }
  },

  async removePermission(roleId: string, permissionId: string): Promise<void> {
    try {
      await api.delete(`/roles/${roleId}/permissions/${permissionId}`);
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

export const permissionsService = {
  async getAll(): Promise<PermissionGroup[]> {
    try {
      const response = await api.get('/permissions');
      return response.data;
    } catch (error: any) {
      handleApiError(error, []);
      return [];
    }
  },

  async getList(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: Permission[]; meta: any }> {
    try {
      const response = await api.get('/permissions/list', { params });
      return response.data;
    } catch (error: any) {
      handleApiError(error, { data: [], meta: {} });
      return { data: [], meta: {} };
    }
  },
};

