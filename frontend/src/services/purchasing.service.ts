import { api } from './api';

// ============================================
// Interfaces
// ============================================

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  branchId: string;
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  orderDate: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  paymentTermDays?: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingCost: number;
  totalAmount: number;
  notes?: string;
  supplierConfirmed: boolean;
  supplierConfirmedAt?: string;
  createdBy: string;
  approvedBy?: string;
  approvedBy2?: string;
  approvedAt?: string;
  orderedBy?: string;
  orderedAt?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  supplier?: {
    id: string;
    customerCode: string;
    name: string;
    phone?: string;
    email?: string;
  };
  branch?: {
    id: string;
    code: string;
    name: string;
  };
  items?: PurchaseOrderItem[];
  goodsReceipts?: GoodsReceipt[];
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  subtotal: number;
  notes?: string;
  product?: {
    id: string;
    sku: string;
    name: string;
    category?: {
      id: string;
      name: string;
    };
    brand?: {
      id: string;
      name: string;
    };
  };
}

export interface GoodsReceipt {
  id: string;
  grNumber: string;
  purchaseOrderId?: string;
  branchId: string;
  receiptDate: string;
  status: 'draft' | 'received' | 'inspected' | 'approved' | 'rejected' | 'cancelled';
  inspectionStatus?: 'pending' | 'passed' | 'failed' | 'partial';
  inspectionNotes?: string;
  variancePercent?: number;
  notes?: string;
  receivedBy: string;
  inspectedBy?: string;
  inspectedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  purchaseOrder?: PurchaseOrder;
  branch?: {
    id: string;
    code: string;
    name: string;
  };
  items?: GoodsReceiptItem[];
}

export interface GoodsReceiptItem {
  id: string;
  goodsReceiptId: string;
  purchaseOrderItemId?: string;
  productId: string;
  quantityReceived: number;
  quantityAccepted: number;
  quantityRejected: number;
  unitPrice: number;
  batchNumber?: string;
  serialNumber?: string;
  expiryDate?: string;
  inspectionStatus?: 'pending' | 'passed' | 'failed' | 'partial';
  inspectionNotes?: string;
  notes?: string;
  product?: {
    id: string;
    sku: string;
    name: string;
    category?: {
      id: string;
      name: string;
    };
    brand?: {
      id: string;
      name: string;
    };
  };
  purchaseOrderItem?: PurchaseOrderItem;
}

// ============================================
// Service Methods
// ============================================

export const purchasingService = {
  /**
   * Create purchase order
   */
  async createPurchaseOrder(data: {
    supplier_id: string;
    branch_id: string;
    order_date: string;
    expected_delivery_date?: string;
    payment_terms?: string;
    payment_term_days?: number;
    discount_amount?: number;
    tax_amount?: number;
    shipping_cost?: number;
    notes?: string;
    items: Array<{
      product_id: string;
      quantity_ordered: number;
      unit_price: number;
      discount_percent?: number;
      notes?: string;
    }>;
  }) {
    const response = await api.post('/purchasing/purchase-orders', data);
    return response.data.data || response.data;
  },

  /**
   * Get purchase orders list
   */
  async getPurchaseOrders(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    supplierId?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: PurchaseOrder[]; total: number; page: number; limit: number; totalPages: number }> {
    const response = await api.get('/purchasing/purchase-orders', { params });
    // Backend returns { data: [], total, page, limit, totalPages }
    // If response.data already has the structure, return it
    if (response.data && Array.isArray(response.data.data) && typeof response.data.total === 'number') {
      return response.data;
    }
    // Otherwise wrap it
    return {
      data: Array.isArray(response.data) ? response.data : response.data?.data || [],
      total: response.data?.total || 0,
      page: response.data?.page || params?.page || 1,
      limit: response.data?.limit || params?.limit || 20,
      totalPages: response.data?.totalPages || 0,
    };
  },

  /**
   * Get purchase order by ID
   */
  async getPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const response = await api.get(`/purchasing/purchase-orders/${id}`);
    return response.data.data || response.data;
  },

  /**
   * Update purchase order
   */
  async updatePurchaseOrder(
    id: string,
    data: {
      expected_delivery_date?: string;
      payment_terms?: string;
      payment_term_days?: number;
      discount_amount?: number;
      tax_amount?: number;
      shipping_cost?: number;
      notes?: string;
      items?: Array<{
        product_id: string;
        quantity_ordered: number;
        unit_price: number;
        discount_percent?: number;
        notes?: string;
      }>;
    },
  ) {
    const response = await api.put(`/purchasing/purchase-orders/${id}`, data);
    return response.data.data || response.data;
  },

  /**
   * Approve purchase order
   */
  async approvePurchaseOrder(id: string, notes?: string) {
    const response = await api.post(`/purchasing/purchase-orders/${id}/approve`, { notes });
    return response.data.data || response.data;
  },

  /**
   * Mark purchase order as ordered
   */
  async orderPurchaseOrder(id: string) {
    const response = await api.post(`/purchasing/purchase-orders/${id}/order`);
    return response.data.data || response.data;
  },

  /**
   * Cancel purchase order
   */
  async cancelPurchaseOrder(id: string, reason?: string) {
    const response = await api.post(`/purchasing/purchase-orders/${id}/cancel`, { reason });
    return response.data.data || response.data;
  },

  /**
   * Create goods receipt
   */
  async createGoodsReceipt(data: {
    purchase_order_id?: string;
    branch_id: string;
    receipt_date: string;
    notes?: string;
    items: Array<{
      purchase_order_item_id?: string;
      product_id: string;
      quantity_received: number;
      unit_price: number;
      batch_number?: string;
      serial_number?: string;
      expiry_date?: string;
      notes?: string;
    }>;
  }) {
    const response = await api.post('/purchasing/goods-receipts', data);
    return response.data.data || response.data;
  },

  /**
   * Get goods receipts list
   */
  async getGoodsReceipts(params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    purchaseOrderId?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: GoodsReceipt[]; total: number; page: number; limit: number; totalPages: number }> {
    const response = await api.get('/purchasing/goods-receipts', { params });
    // Backend returns { data: [], total, page, limit, totalPages }
    // If response.data already has the structure, return it
    if (response.data && Array.isArray(response.data.data) && typeof response.data.total === 'number') {
      return response.data;
    }
    // Otherwise wrap it
    return {
      data: Array.isArray(response.data) ? response.data : response.data?.data || [],
      total: response.data?.total || 0,
      page: response.data?.page || params?.page || 1,
      limit: response.data?.limit || params?.limit || 20,
      totalPages: response.data?.totalPages || 0,
    };
  },

  /**
   * Get goods receipt by ID
   */
  async getGoodsReceipt(id: string): Promise<GoodsReceipt> {
    const response = await api.get(`/purchasing/goods-receipts/${id}`);
    // Backend returns the goods receipt object directly
    return response.data.data || response.data;
  },

  /**
   * Approve goods receipt
   */
  async approveGoodsReceipt(
    id: string,
    data?: {
      inspection_status?: 'passed' | 'failed' | 'partial';
      inspection_notes?: string;
      notes?: string;
    },
  ) {
    const response = await api.post(`/purchasing/goods-receipts/${id}/approve`, data || {});
    return response.data.data || response.data;
  },

  /**
   * Reject goods receipt
   */
  async rejectGoodsReceipt(id: string, reason: string) {
    const response = await api.post(`/purchasing/goods-receipts/${id}/reject`, { reason });
    return response.data.data || response.data;
  },

  /**
   * Cancel goods receipt
   */
  async cancelGoodsReceipt(id: string, reason?: string) {
    const response = await api.post(`/purchasing/goods-receipts/${id}/cancel`, { reason });
    return response.data.data || response.data;
  },
};

