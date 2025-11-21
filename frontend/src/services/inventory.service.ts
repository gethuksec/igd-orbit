import { api, handleApiError } from './api';

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromBranchId: string;
  fromBranch?: { id: string; name: string; code: string };
  toBranchId: string;
  toBranch?: { id: string; name: string; code: string };
  transferType: 'regular' | 'urgent';
  status: 'pending' | 'approved' | 'sent' | 'received' | 'cancelled';
  items: StockTransferItem[];
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: string | null;
  sentBy?: string;
  sentAt?: string | null;
  receivedBy?: string;
  receivedAt?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockTransferItem {
  id: string;
  transferId: string;
  productId: string;
  product?: { id: string; name: string; sku: string; costPrice: any };
  quantityRequested: number;
  quantitySent?: number | null;
  quantityReceived?: number | null;
  notes?: string;
}


export interface StockOpname {
  id: string;
  opnameNumber: string;
  branchId: string;
  branch?: { id: string; name: string; code: string };
  opnameDate: string;
  status: 'draft' | 'counting' | 'completed' | 'approved';
  items: StockOpnameItem[];
  totalDiscrepancyValue?: number | null;
  startedBy: string;
  completedBy?: string | null;
  completedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockOpnameItem {
  id: string;
  opnameId: string;
  productId: string;
  product?: { id: string; name: string; sku: string; costPrice: any; category?: any; brand?: any };
  systemQuantity: number;
  physicalQuantity?: number | null;
  discrepancy?: number | null;
  discrepancyValue?: number | null;
  condition?: 'good' | 'damaged' | 'expired' | null;
  notes?: string;
  countedBy?: string | null;
}


export const inventoryService = {
  // Stock Summary
  async getStockSummary(params?: {
    page?: number;
    limit?: number;
    branchId?: string;
    categoryId?: string;
    brandId?: string;
    stockStatus?: 'low' | 'out' | 'available';
    search?: string;
  }) {
    try {
      const response = await api.get('/inventory/stock', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getProductStock(productId: string) {
    try {
      const response = await api.get(`/inventory/stock/${productId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getLowStockAlerts(branchId?: string) {
    try {
      const response = await api.get('/inventory/alerts', { params: { branchId } });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, { totalAlerts: 0, byBranch: {}, items: [] });
    }
  },

  async getStockMovementHistory(params?: {
    page?: number;
    limit?: number;
    productId?: string;
    branchId?: string;
    movementType?: string;
    referenceType?: string;
    startDate?: string;
    endDate?: string;
  }) {
    try {
      const response = await api.get('/inventory/movements', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async adjustStock(data: {
    productId: string;
    branchId: string;
    type: 'IN' | 'OUT' | 'DAMAGE' | 'FOUND' | 'CORRECTION';
    quantityChange: number;
    reason: string;
    notes?: string;
    batchNumber?: string;
    serialNumber?: string;
  }) {
    try {
      const response = await api.post('/inventory/adjustment', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Stock Transfer
  async getTransfers(params?: {
    branchId?: string;
    status?: string;
  }): Promise<StockTransfer[]> {
    try {
      const response = await api.get('/inventory/transfers', { params });
      return Array.isArray(response.data) ? response.data : response.data.data || [];
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getTransferById(id: string): Promise<StockTransfer> {
    try {
      const response = await api.get(`/inventory/transfers/${id}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createTransfer(data: {
    fromBranchId: string;
    toBranchId: string;
    transferType: 'regular' | 'urgent';
    items: Array<{ productId: string; quantityRequested: number; notes?: string }>;
    notes?: string;
  }): Promise<StockTransfer> {
    try {
      const response = await api.post('/inventory/transfers', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async approveTransfer(id: string): Promise<StockTransfer> {
    try {
      const response = await api.post(`/inventory/transfers/${id}/approve`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async sendTransfer(id: string): Promise<StockTransfer> {
    try {
      const response = await api.post(`/inventory/transfers/${id}/send`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async receiveTransfer(id: string, data: {
    items: Array<{ itemId: string; quantityReceived: number; condition?: 'good' | 'damaged' | 'expired'; notes?: string }>;
  }): Promise<StockTransfer> {
    try {
      const response = await api.post(`/inventory/transfers/${id}/receive`, data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async cancelTransfer(id: string): Promise<StockTransfer> {
    try {
      const response = await api.post(`/inventory/transfers/${id}/cancel`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Stock Opname
  async getOpnames(params?: {
    branchId?: string;
    status?: string;
  }): Promise<StockOpname[]> {
    try {
      const response = await api.get('/inventory/opname', { params });
      return Array.isArray(response.data) ? response.data : response.data.data || [];
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getOpnameById(id: string): Promise<StockOpname> {
    try {
      const response = await api.get(`/inventory/opname/${id}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async startOpname(data: {
    branchId: string;
    opnameDate: string;
    notes?: string;
  }): Promise<StockOpname> {
    try {
      const response = await api.post('/inventory/opname', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async recordCount(opnameId: string, data: {
    items: Array<{
      productId: string;
      physicalQuantity: number;
      condition?: 'good' | 'damaged' | 'expired';
      notes?: string;
      countedBy?: string;
    }>;
  }): Promise<StockOpname> {
    try {
      const response = await api.post(`/inventory/opname/${opnameId}/items`, data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async completeOpname(id: string): Promise<StockOpname> {
    try {
      const response = await api.post(`/inventory/opname/${id}/complete`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async approveOpname(id: string): Promise<StockOpname> {
    try {
      const response = await api.post(`/inventory/opname/${id}/approve`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

};

