import { api, handleApiError } from './api';

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromBranchId: string;
  fromBranch?: { id: string; name: string; code: string };
  toBranchId: string;
  toBranch?: { id: string; name: string; code: string };
  status: 'pending' | 'approved' | 'in-transit' | 'received' | 'rejected' | 'cancelled';
  items: StockTransferItem[];
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockTransferItem {
  id: string;
  productId: string;
  product?: { id: string; name: string; sku: string };
  quantity: number;
  quantityReceived?: number;
}

export interface StockTransferListResponse {
  data: StockTransfer[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StockOpname {
  id: string;
  opnameNumber: string;
  branchId: string;
  branch?: { id: string; name: string; code: string };
  status: 'draft' | 'in-progress' | 'completed' | 'approved' | 'rejected';
  startDate: string;
  endDate?: string;
  items: StockOpnameItem[];
  totalVariance: number;
  totalVarianceValue: number;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockOpnameItem {
  id: string;
  productId: string;
  product?: { id: string; name: string; sku: string };
  systemQuantity: number;
  physicalQuantity: number;
  variance: number;
  varianceValue: number;
  notes?: string;
}

export interface StockOpnameListResponse {
  data: StockOpname[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface StockAdjustment {
  id: string;
  adjustmentNumber: string;
  branchId: string;
  branch?: { id: string; name: string; code: string };
  productId: string;
  product?: { id: string; name: string; sku: string };
  adjustmentType: 'increase' | 'decrease';
  quantity: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockAdjustmentListResponse {
  data: StockAdjustment[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const inventoryService = {
  // Stock Transfer
  async getTransfers(params?: {
    page?: number;
    limit?: number;
    status?: string;
    fromBranchId?: string;
    toBranchId?: string;
  }): Promise<StockTransferListResponse> {
    try {
      const response = await api.get('/inventory/transfers', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getTransferById(id: string): Promise<StockTransfer> {
    try {
      const response = await api.get(`/inventory/transfers/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createTransfer(data: {
    fromBranchId: string;
    toBranchId: string;
    items: Array<{ productId: string; quantity: number }>;
    notes?: string;
  }): Promise<StockTransfer> {
    try {
      const response = await api.post('/inventory/transfers', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async approveTransfer(id: string, data?: { notes?: string }): Promise<StockTransfer> {
    try {
      const response = await api.put(`/inventory/transfers/${id}/approve`, data || {});
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async receiveTransfer(id: string, data: {
    items: Array<{ itemId: string; quantityReceived: number }>;
    notes?: string;
  }): Promise<StockTransfer> {
    try {
      const response = await api.put(`/inventory/transfers/${id}/receive`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async rejectTransfer(id: string, data: { reason: string }): Promise<StockTransfer> {
    try {
      const response = await api.put(`/inventory/transfers/${id}/reject`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Stock Opname
  async getOpnames(params?: {
    page?: number;
    limit?: number;
    status?: string;
    branchId?: string;
  }): Promise<StockOpnameListResponse> {
    try {
      const response = await api.get('/inventory/opname', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getOpnameById(id: string): Promise<StockOpname> {
    try {
      const response = await api.get(`/inventory/opname/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async startOpname(data: {
    branchId: string;
    notes?: string;
  }): Promise<StockOpname> {
    try {
      const response = await api.post('/inventory/opname', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async recordCount(opnameId: string, data: {
    productId: string;
    physicalQuantity: number;
    notes?: string;
  }): Promise<StockOpnameItem> {
    try {
      const response = await api.post(`/inventory/opname/${opnameId}/count`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async completeOpname(id: string, data?: { notes?: string }): Promise<StockOpname> {
    try {
      const response = await api.put(`/inventory/opname/${id}/complete`, data || {});
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async approveOpname(id: string, data?: { notes?: string }): Promise<StockOpname> {
    try {
      const response = await api.put(`/inventory/opname/${id}/approve`, data || {});
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Stock Adjustment
  async getAdjustments(params?: {
    page?: number;
    limit?: number;
    status?: string;
    branchId?: string;
    productId?: string;
  }): Promise<StockAdjustmentListResponse> {
    try {
      const response = await api.get('/inventory/adjustment', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getAdjustmentById(id: string): Promise<StockAdjustment> {
    try {
      const response = await api.get(`/inventory/adjustment/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createAdjustment(data: {
    branchId: string;
    productId: string;
    adjustmentType: 'increase' | 'decrease';
    quantity: number;
    reason: string;
    notes?: string;
  }): Promise<StockAdjustment> {
    try {
      const response = await api.post('/inventory/adjustment', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async approveAdjustment(id: string, data?: { notes?: string }): Promise<StockAdjustment> {
    try {
      const response = await api.put(`/inventory/adjustment/${id}/approve`, data || {});
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async rejectAdjustment(id: string, data: { reason: string }): Promise<StockAdjustment> {
    try {
      const response = await api.put(`/inventory/adjustment/${id}/reject`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

