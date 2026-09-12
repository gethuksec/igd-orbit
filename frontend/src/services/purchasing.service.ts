import { api } from './api';

// ============================================
// Interfaces
// ============================================

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  branchId: string;
  status: 'draft' | 'pending' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'rejected' | 'cancelled';
  orderDate: string;
  expectedDeliveryDate?: string;
  paymentTerms?: string;
  paymentTermDays?: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  isOverdue?: boolean;
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
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
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
  status: 'draft' | 'received' | 'inspected' | 'revisit' | 'approved' | 'rejected' | 'cancelled';
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
  revisitBy?: string;
  revisitAt?: string;
  revisitReason?: string;
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
  events?: GoodsReceiptEvent[];
}

export interface GoodsReceiptEvent {
  id: string;
  goodsReceiptId: string;
  action: string;
  actorId: string;
  note?: string;
  createdAt: string;
  actor?: {
    id: string;
    fullName?: string | null;
    email: string;
  };
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
    branch_id?: string;
    invoice_number: string;
    invoice_date: string;
    order_date: string;
    expected_delivery_date: string;
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
      // IGDERP-82 (S3): mandatory for post-approval edits (approved/ordered).
      reason?: string;
      invoice_number?: string;
      invoice_date?: string;
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

  /** IGDERP-82: reject purchase order (approver denies a pending PO) */
  async rejectPurchaseOrder(id: string, reason?: string) {
    const response = await api.post(`/purchasing/purchase-orders/${id}/reject`, { reason });
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

  /** IGDERP-80: revisiting — approver returns GR to processor (SODO) */
  async revisitGoodsReceipt(id: string, reason: string) {
    const response = await api.post(`/purchasing/goods-receipts/${id}/revisit`, { reason });
    return response.data.data || response.data;
  },

  /** IGDERP-80: processor (SODO) updates per-item receiving quantities */
  async updateGoodsReceiptReceiving(
    id: string,
    items: Array<{
      id: string;
      quantity_received: number;
      quantity_rejected?: number;
      batch_number?: string;
      serial_number?: string;
      expiry_date?: string;
      notes?: string;
    }>,
  ) {
    const response = await api.patch(`/purchasing/goods-receipts/${id}/receiving`, { items });
    return response.data.data || response.data;
  },

  /** IGDERP-80: approval settings */
  async getApprovalSettings() {
    const response = await api.get('/approval-settings');
    return response.data.data || response.data;
  },

  async updateApprovalSetting(
    category: string,
    data: { roles?: string[]; userIds?: string[]; mandatoryInvoice?: boolean },
  ) {
    const response = await api.put(`/approval-settings/${category}`, data);
    return response.data.data || response.data;
  },

  /** IGDERP-81: supplier invoice / delivery-note attachments (PO + GR) */
  async uploadAttachments(
    entityType: 'PURCHASE_ORDER' | 'GOODS_RECEIPT',
    entityId: string,
    documentType: string,
    files: File[],
  ) {
    const form = new FormData();
    form.append('entityType', entityType);
    form.append('entityId', entityId);
    form.append('documentType', documentType);
    files.forEach((f) => form.append('files', f));
    const response = await api.post('/purchasing/attachments', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data || response.data;
  },

  async getAttachments(entityType: 'PURCHASE_ORDER' | 'GOODS_RECEIPT', entityId: string) {
    const response = await api.get('/purchasing/attachments', {
      params: { entityType, entityId },
    });
    return response.data.data || response.data;
  },

  async deleteAttachment(id: string) {
    const response = await api.delete(`/purchasing/attachments/${id}`);
    return response.data.data || response.data;
  },

  // ============================================
  // S4 (IGDERP-84): Purchase Returns — Retur Pembelian
  // ============================================

  async getPurchaseReturns(params?: {
    page?: number;
    limit?: number;
    search?: string;
    purchaseOrderId?: string;
  }): Promise<{ data: PurchaseReturn[]; total: number; page: number; limit: number; totalPages: number }> {
    const response = await api.get('/purchasing/purchase-returns', { params });
    const payload = response.data?.data ?? response.data;
    const meta = response.data?.meta;
    if (Array.isArray(payload)) {
      return {
        data: payload,
        total: meta?.total ?? payload.length,
        page: meta?.page ?? 1,
        limit: meta?.limit ?? 20,
        totalPages: meta?.totalPages ?? 1,
      };
    }
    return { data: payload || [], total: meta?.total ?? 0, page: meta?.page ?? 1, limit: meta?.limit ?? 20, totalPages: meta?.totalPages ?? 0 };
  },

  async getPurchaseReturn(id: string): Promise<PurchaseReturn> {
    const response = await api.get(`/purchasing/purchase-returns/${id}`);
    return response.data.data || response.data;
  },

  async createPurchaseReturn(data: {
    purchase_order_id?: string;
    supplier_id?: string;
    invoice_number?: string;
    reason: string;
    notes?: string;
    items: Array<{ product_id: string; quantity: number; unit_price?: number; reason?: string; notes?: string }>;
  }): Promise<PurchaseReturn> {
    const response = await api.post('/purchasing/purchase-returns', data);
    return response.data.data || response.data;
  },

  /** Completion: goods shipped back to supplier → central-bad −qty. */
  async completePurchaseReturn(id: string, notes?: string): Promise<PurchaseReturn> {
    const response = await api.post(`/purchasing/purchase-returns/${id}/complete`, { notes });
    return response.data.data || response.data;
  },
};

export interface PurchaseReturnItem {
  id: string;
  purchaseReturnId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  reason?: string | null;
  notes?: string | null;
  product?: { id: string; name: string; sku: string };
}

export interface PurchaseReturn {
  id: string;
  returnNumber: string;
  purchaseOrderId?: string | null;
  supplierId: string;
  invoiceNumber?: string | null;
  processedBy: string;
  reason: string;
  notes?: string | null;
  totalQty: number;
  totalValue: number;
  status: 'pending' | 'completed';
  completedAt?: string | null;
  completionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  purchaseOrder?: { id: string; poNumber: string; invoiceNumber?: string | null; status: string } | null;
  supplier?: { id: string; name: string; customerCode: string };
  processedByUser?: { id: string; fullName: string };
  completedByUser?: { id: string; fullName: string } | null;
  items?: PurchaseReturnItem[];
}

