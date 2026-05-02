import { api, handleApiError } from './api';

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  isActive: boolean;
  roles?: UserRole[];
  branchIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserRole {
  id: string;
  code: string;
  name: string;
  branchId?: string | null;
  branchName?: string | null;
  isPrimary: boolean;
  validFrom: string;
  validUntil?: string | null;
  // Legacy format support (for backward compatibility)
  role?: {
    id: string;
    code: string;
    name: string;
  };
  branch?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface UserListResponse {
  data: User[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateUserDto {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  isActive?: boolean;
}

export interface UpdateUserDto {
  email?: string;
  fullName?: string;
  phone?: string;
  isActive?: boolean;
}

export interface AssignRoleDto {
  roleId: string;
  branchId?: string | null;
  validFrom?: string;
  validUntil?: string | null;
}

export const usersService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    order?: 'asc' | 'desc';
  }): Promise<UserListResponse> {
    try {
      const response = await api.get('/users', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    }
  },

  async getById(id: string): Promise<User> {
    try {
      const response = await api.get(`/users/${id}`);
      return response.data;
    } catch (error: any) {
      handleApiError(error, {} as User);
      throw error;
    }
  },

  async create(data: CreateUserDto): Promise<User> {
    try {
      const response = await api.post('/users', data);
      return response.data;
    } catch (error: any) {
      handleApiError(error, {} as User);
      throw error;
    }
  },

  async update(id: string, data: UpdateUserDto): Promise<User> {
    try {
      const response = await api.put(`/users/${id}`, data);
      return response.data;
    } catch (error: any) {
      handleApiError(error, {} as User);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await api.delete(`/users/${id}`);
    } catch (error: any) {
      handleApiError(error, undefined);
      throw error;
    }
  },

  async assignRole(userId: string, data: AssignRoleDto): Promise<UserRole> {
    try {
      const response = await api.post(`/users/${userId}/roles`, data);
      return response.data;
    } catch (error: any) {
      handleApiError(error, {} as UserRole);
      throw error;
    }
  },

  async removeRole(userId: string, userRoleId: string): Promise<void> {
    try {
      await api.delete(`/users/${userId}/roles/${userRoleId}`);
    } catch (error: any) {
      handleApiError(error, undefined);
      throw error;
    }
  },
};

