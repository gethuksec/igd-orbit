import { api, handleApiError } from './api';

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  fromBranchId: string | null;
  toBranchId: string | null;
  fromWarehouse?: { id: string; code: string; name: string };
  toWarehouse?: { id: string; code: string; name: string };
  fromBranch?: { id: string; name: string; code: string };
  toBranch?: { id: string; name: string; code: string } | null;
  transferType: string;
  status: string;
  items: StockTransferItem[];
  requestedBy: string;
  picName?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockTransferItem {
  id: string;
  transferId: string;
  productId: string;
  productName?: string | null;
  productSku?: string | null;
  product?: { id: string; name: string; sku: string; costPrice: any };
  quantityRequested: number;
  quantitySent?: number | null;
  quantityReceived?: number | null;
  notes?: string;
}

export interface StockTransferWarehouse {
  id: string;
  code: string;
  name: string;
  type: string;
  scope: string;
  outletId?: string | null;
  outlet?: { id: string; name: string; code: string } | null;
}

export interface TransferStockProduct {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  unitId?: string | null;
  unit?: { id: string; name: string } | null;
  availableQuantity: number;
}


export interface StockOpname {
  id: string;
  opnameNumber: string;
  warehouseId: string;
  branchId: string;
  branch?: { id: string; name: string; code: string };
  opnameDate: string;
  status: 'draft' | 'counting' | 'completed' | 'approved' | 'cancelled';
  items: StockOpnameItem[];
  totalDiscrepancyValue?: number | null;
  startedBy: string;
  completedBy?: string | null;
  completedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockOpnameItem {
  id: string;
  opnameId: string;
  productId: string;
  product?: { id: string; name: string; sku: string; barcode?: string | null; costPrice: any; category?: any; brand?: any };
  systemQuantity: number;
  systemQuantityAtCount?: number | null;
  liveQuantity?: number | null;
  physicalQuantity?: number | null;
  discrepancy?: number | null;
  discrepancyValue?: number | null;
  condition?: 'good' | 'damaged' | 'expired' | null;
  notes?: string;
  countedBy?: string | null;
}

export interface StockIn {
  id: string;
  documentNumber: string;
  outletId: string;
  outlet?: { id: string; name: string; code: string };
  warehouseId: string;
  warehouse?: { id: string; code: string; name: string; type: string; scope: string };
  supplierId?: string | null;
  supplierName?: string | null;
  documentDate: string;
  reason: string;
  totalValue: number;
  createdBy: string;
  createdAt: string;
  items: StockInItem[];
}

export interface StockInItem {
  id: string;
  stockInId: string;
  productId: string;
  product?: { id: string; name: string; sku: string; barcode?: string | null };
  productName: string;
  productSku: string;
  quantity: number;
  unitId?: string | null;
  unitName?: string | null;
  stockValue: number;
  lineTotal: number;
}

export interface StockInWarehouse {
  id: string;
  code: string;
  name: string;
  type: string;
  scope: string;
  outletId?: string | null;
}

export interface StockInProduct {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  sellingPrice: number;
  minSellingPrice?: number | null;
  memberPricing?: Record<string, number> | null;
  unitId?: string | null;
  unit?: { id: string; name: string } | null;
}

export interface StockInTier {
  id: string;
  code: string;
  name: string;
  level: number;
}

export interface StockOut {
  id: string;
  documentNumber: string;
  outletId?: string | null;
  outlet?: { id: string; name: string; code: string } | null;
  warehouseId: string;
  warehouse?: { id: string; code: string; name: string; type: string; scope: string } | null;
  documentDate: string;
  reason: string;
  totalValue: number;
  createdBy: string;
  createdAt: string;
  items: StockOutItem[];
}

export interface StockOutItem {
  id: string;
  stockOutId: string;
  productId: string;
  product?: { id: string; name: string; sku: string; barcode?: string | null };
  productName: string;
  productSku: string;
  quantity: number;
  unitId?: string | null;
  unitName?: string | null;
  stockValue: number;
  lineTotal: number;
}

export interface StockOutWarehouse {
  id: string;
  code: string;
  name: string;
  type: string;
  scope: string;
  outletId?: string | null;
}

export interface StockOutProduct {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  sellingPrice: number;
  minSellingPrice?: number | null;
  memberPricing?: Record<string, number> | null;
  unitId?: string | null;
  unit?: { id: string; name: string } | null;
  availableQuantity: number;
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
    hideZero?: boolean;
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
    search?: string;
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

  // ── Transfer Stock v2 (Pemindahan Barang — intra-outlet, IGDERP-139) ──
  async createTransferStock(data: {
    outletId: string;
    warehouseId: string;
    toWarehouseId: string;
    notes?: string;
    items: Array<{ productId: string; quantity: number }>;
  }): Promise<StockTransfer> {
    try {
      const response = await api.post('/transfer-stock', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getTransfers(params?: {
    page?: number;
    limit?: number;
    outletId?: string;
    warehouseId?: string;
  }): Promise<{ data: StockTransfer[]; meta: any }> {
    try {
      const response = await api.get('/transfer-stock', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getTransferById(id: string): Promise<StockTransfer> {
    try {
      const response = await api.get(`/transfer-stock/${id}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Transfer Stock form supporting lists
  async getTransferWarehouses(outletId?: string): Promise<StockTransferWarehouse[]> {
    try {
      const response = await api.get('/transfer-stock/warehouses', {
        params: outletId ? { outletId } : {},
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  // ── Mutasi (central ↔ outlet movement, IGDERP-140) ──
  async createMutasi(data: {
    fromWarehouseId: string;
    toWarehouseId: string;
    notes?: string;
    items: Array<{ productId: string; quantity: number }>;
  }): Promise<StockTransfer> {
    try {
      const response = await api.post('/mutasi', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getMutasi(params?: {
    page?: number;
    limit?: number;
    outletId?: string;
    warehouseId?: string;
  }): Promise<{ data: StockTransfer[]; meta: any }> {
    try {
      const response = await api.get('/mutasi', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getMutasiById(id: string): Promise<StockTransfer> {
    try {
      const response = await api.get(`/mutasi/${id}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // IGDERP-173: mutasi transit → receive lifecycle
  async sendMutasi(
    id: string,
    data: { items?: Array<{ itemId: string; quantitySent?: number }> },
  ): Promise<StockTransfer> {
    const response = await api.post(`/mutasi/${id}/send`, data);
    return response.data;
  },

  async receiveMutasi(
    id: string,
    data: {
      items: Array<{
        itemId: string;
        quantityReceived: number;
        damageQuantity?: number;
        damagePhotoUrl?: string;
        damageNotes?: string;
      }>;
    },
  ): Promise<StockTransfer> {
    const response = await api.post(`/mutasi/${id}/receive`, data);
    return response.data;
  },

  async cancelMutasi(id: string): Promise<StockTransfer> {
    const response = await api.post(`/mutasi/${id}/cancel`);
    return response.data;
  },

  /** All move-endpoint warehouses: system central (good/bad) + outlet GOOD. */
  async getMutasiWarehouses(): Promise<StockTransferWarehouse[]> {
    try {
      const response = await api.get('/mutasi/warehouses');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async searchTransferProducts(
    q: string,
    limit = 15,
    warehouseId?: string,
  ): Promise<TransferStockProduct[]> {
    try {
      const response = await api.get('/transfer-stock/products', {
        params: { q, limit, ...(warehouseId ? { warehouseId } : {}) },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      return handleApiError(error, []);
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
      force?: boolean;
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

  // IGDERP-177: result document download (.xlsx blob)
  async exportOpnameExcel(id: string): Promise<Blob> {
    const response = await api.get(`/inventory/opname/${id}/export`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async approveOpname(id: string): Promise<StockOpname> {
    try {
      const response = await api.post(`/inventory/opname/${id}/approve`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /** Draft model: add a product to the ongoing opname. */
  async addOpnameItem(opnameId: string, productId: string): Promise<StockOpname> {
    try {
      const response = await api.post(`/inventory/opname/${opnameId}/items/add`, { productId });
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /** Draft model: remove a product from the ongoing opname. */
  async removeOpnameItem(opnameId: string, itemId: string): Promise<StockOpname> {
    try {
      const response = await api.delete(`/inventory/opname/${opnameId}/items/${itemId}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  /** Cancel/void the ongoing opname (frees the outlet for a new one). */
  async cancelOpname(id: string): Promise<StockOpname> {
    try {
      const response = await api.post(`/inventory/opname/${id}/cancel`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // ── Stock In (Stok Masuk) ──
  async createStockIn(data: {
    outletId: string;
    warehouseId: string;
    supplierId?: string;
    date?: string;
    reason: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitId?: string;
      stockValue?: number;
    }>;
  }): Promise<StockIn> {
    try {
      const response = await api.post('/stock-in', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getStockIns(params?: {
    page?: number;
    limit?: number;
    outletId?: string;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: StockIn[]; meta: any }> {
    try {
      const response = await api.get('/stock-in', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getStockInById(id: string): Promise<StockIn> {
    try {
      const response = await api.get(`/stock-in/${id}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Stock In form supporting lists
  async getStockInWarehouses(outletId?: string): Promise<StockInWarehouse[]> {
    try {
      const response = await api.get('/stock-in/warehouses', {
        params: outletId ? { outletId } : {},
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async searchStockInProducts(q: string, limit = 15): Promise<StockInProduct[]> {
    try {
      const response = await api.get('/stock-in/products', {
        params: { q, limit },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getStockInTiers(): Promise<StockInTier[]> {
    try {
      const response = await api.get('/stock-in/tiers');
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  // ── Stock Out (Stok Keluar) ──
  async createStockOut(data: {
    outletId?: string;
    warehouseId: string;
    date?: string;
    reason: string;
    items: Array<{
      productId: string;
      quantity: number;
      unitId?: string;
      stockValue?: number;
    }>;
  }): Promise<StockOut> {
    try {
      const response = await api.post('/stock-out', data);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async getStockOuts(params?: {
    page?: number;
    limit?: number;
    outletId?: string;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: StockOut[]; meta: any }> {
    try {
      const response = await api.get('/stock-out', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getStockOutById(id: string): Promise<StockOut> {
    try {
      const response = await api.get(`/stock-out/${id}`);
      return response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Stock Out form supporting lists
  async getStockOutWarehouses(outletId?: string): Promise<StockOutWarehouse[]> {
    try {
      const response = await api.get('/stock-out/warehouses', {
        params: outletId ? { outletId } : {},
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async searchStockOutProducts(q: string, limit = 15, warehouseId?: string): Promise<StockOutProduct[]> {
    try {
      const response = await api.get('/stock-out/products', {
        params: { q, limit, ...(warehouseId ? { warehouseId } : {}) },
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

};

