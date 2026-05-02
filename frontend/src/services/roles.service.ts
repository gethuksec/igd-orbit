import { api, handleApiError } from './api';

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  level: number;
  isSystemRole: boolean;
  isActive: boolean;
  permissions?: Permission[] | RolePermission[];
  userCount?: number; // Number of users with this role
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  module: string;
  submodule: string | null;
  action: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface RolePermission {
  id: string;
  roleId: string;
  permissionId: string;
  permission: Permission;
  maxAmount?: number | null;
  requiresApproval?: boolean;
  conditions?: any;
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
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  level?: number;
  isActive?: boolean;
  parentRoleId?: string | null;
}

export interface AssignPermissionDto {
  permissionId: string;
  maxAmount?: number | null;
  requiresApproval?: boolean;
  conditions?: Record<string, any>;
}

// Grouped permissions structure from backend
// Format: { [module: string]: { [submodule: string]: Array<{ id, action, description }> } }
export type GroupedPermissions = Record<
  string,
  Record<string, Array<{ id: string; action: string; description: string | null }>>
>;

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

  async getPermissions(id: string): Promise<{ permissions: Permission[] }> {
    try {
      const response = await api.get(`/roles/${id}/permissions`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, { permissions: [] });
    }
  },

  async assignPermission(roleId: string, data: AssignPermissionDto): Promise<RolePermission> {
    try {
      const response = await api.post(`/roles/${roleId}/permissions`, data);
      return response.data;
    } catch (error: any) {
      handleApiError(error, {} as RolePermission);
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

  // Menu Access Management
  async getMenuAccess(roleId: string): Promise<Array<{ menuKey: string; menuPath?: string; menuLabel: string; isEnabled: boolean }>> {
    try {
      const response = await api.get(`/roles/${roleId}/menu-access`);
      return response.data?.menus || [];
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async updateMenuAccess(roleId: string, menuKeys: string[]): Promise<void> {
    try {
      await api.put(`/roles/${roleId}/menu-access`, { menuKeys });
    } catch (error: any) {
      handleApiError(error, undefined);
      throw error;
    }
  },
};

export const permissionsService = {
  /**
   * Get all permissions grouped by module → submodule
   * Returns: { [module]: { [submodule]: [{ id, action, description }] } }
   */
  async getAllGrouped(): Promise<GroupedPermissions> {
    try {
      const response = await api.get('/permissions');
      return response.data || {};
    } catch (error: any) {
      console.error('Error fetching grouped permissions:', error);
      return {};
    }
  },

  /**
   * Get all permissions (flat list with pagination)
   */
  async getList(params?: {
    page?: number;
    limit?: number;
    module?: string;
    submodule?: string;
    action?: string;
  }): Promise<{ data: Permission[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      const response = await api.get('/permissions/list', { params });
      return response.data || { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    } catch (error: any) {
      console.error('Error fetching permissions list:', error);
      return { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } };
    }
  },

  /**
   * Get permission by ID
   */
  async getById(id: string): Promise<Permission> {
    try {
      const response = await api.get(`/permissions/${id}`);
      return response.data;
    } catch (error: any) {
      handleApiError(error, {} as Permission);
      throw error;
    }
  },
};

