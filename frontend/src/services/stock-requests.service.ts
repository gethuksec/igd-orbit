import { api } from './api';

export interface IntakeStaff {
  id: string;
  name: string;
}

export interface IntakeCategory {
  id: string;
  code: string;
  name: string;
}

export interface IntakeContext {
  outlet: { id: string; code: string; name: string };
  staff: IntakeStaff[];
  categories: IntakeCategory[];
}

export interface IntakeProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category: { id: string; name: string } | null;
  available: number;
}

export interface IntakeMember {
  id: string;
  name: string;
  customerCode: string;
}

export interface IntakeCustomer {
  id: string;
  name: string;
  phone: string;
  subdistrict: string | null;
}

export interface IntakeLink {
  branchId: string;
  branchCode: string;
  branchName: string;
  intakeToken: string | null;
  intakeSlug: string | null;
  intakePath: string | null;
}

export interface IntakeItemPayload {
  barcode: string;
  listing: 'EXIST' | 'NEW';
  productId?: string;
  productName?: string;
  categoryId?: string;
  categoryName?: string;
  quantity: number;
  note?: string;
}

export interface CreateIntakePayload {
  staffName: string;
  customerId?: string;
  /** @deprecated Backwards compat — frontend picker sends customerId instead. */
  customerType?: 'USER' | 'MEMBER';
  memberRef?: string;
  items: IntakeItemPayload[];
}

export interface StockRequestItem {
  id: string;
  barcode: string | null;
  listing: string;
  productId: string | null;
  productName: string;
  categoryId: string | null;
  categoryName: string;
  quantity: number;
  note?: string | null;
  sortOrder: number;
}

export interface StockRequest {
  id: string;
  requestNumber: string;
  branchId: string;
  staffName: string;
  customerType: string;
  memberRef: string | null;
  status: string;
  poNumber: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount?: number;
  items?: StockRequestItem[];
  outlet?: { id: string; code: string; name: string } | null;
}

export const SR_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  WAITING_FOR_PO: 'Waiting for PO',
  CHECKOUT: 'Checkout',
  KEEP_RESERVED: 'Keep/Reserved',
  IN_TRANSIT: 'In Transit',
  RECEIVED: 'Received',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const SR_NEXT: Record<string, string> = {
  APPROVED: 'WAITING_FOR_PO',
  WAITING_FOR_PO: 'CHECKOUT',
  CHECKOUT: 'KEEP_RESERVED',
  KEEP_RESERVED: 'IN_TRANSIT',
  IN_TRANSIT: 'RECEIVED',
};

const unwrap = (res: any) => res.data?.data ?? res.data;

export const stockRequestsService = {
  // ─── Public intake ───
  getIntakeContext(token: string): Promise<IntakeContext> {
    return api.get(`/stock-requests/intake/${token}`).then(unwrap);
  },
  searchIntakeProducts(token: string, q: string, limit = 15): Promise<IntakeProduct[]> {
    return api
      .get(`/stock-requests/intake/${token}/products`, { params: { q, limit } })
      .then(unwrap);
  },
  verifyIntakeMember(token: string, code: string): Promise<IntakeMember> {
    return api
      .get(`/stock-requests/intake/${token}/members/verify`, { params: { code } })
      .then(unwrap);
  },
  searchIntakeCustomers(token: string, q: string, limit = 15): Promise<IntakeCustomer[]> {
    return api
      .get(`/stock-requests/intake/${token}/customers/search`, { params: { q, limit } })
      .then(unwrap);
  },
  quickAddIntakeCustomer(
    token: string,
    payload: { name: string; phone: string; subdistrict: string },
  ): Promise<IntakeCustomer> {
    return api.post(`/stock-requests/intake/${token}/customers/quick-add`, payload).then(unwrap);
  },
  createIntake(token: string, payload: CreateIntakePayload): Promise<StockRequest> {
    return api.post(`/stock-requests/intake/${token}`, payload).then(unwrap);
  },
  intakeLinks(): Promise<IntakeLink[]> {
    return api.get('/stock-requests/intake-links').then(unwrap);
  },

  // ─── SODO review ───
  stats(): Promise<{ waiting: number; inProgress: number; receivedThisMonth: number }> {
    return api.get('/stock-requests/stats').then(unwrap);
  },
  list(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    branchId?: string;
  }): Promise<{ data: StockRequest[]; meta: { total: number; page: number; totalPages: number } }> {
    return api.get('/stock-requests', { params }).then((res) => res.data);
  },
  getById(id: string): Promise<StockRequest> {
    return api.get(`/stock-requests/${id}`).then(unwrap);
  },
  approve(id: string): Promise<StockRequest> {
    return api.patch(`/stock-requests/${id}/approve`).then(unwrap);
  },
  updateStatus(id: string, payload: { status: string; reason?: string; poNumber?: string }) {
    return api.patch(`/stock-requests/${id}/status`, payload).then(unwrap);
  },
  rotateIntakeToken(branchId: string): Promise<{ intakeToken: string; intakeSlug: string | null; intakePath: string | null; branchName: string }> {
    return api.post('/stock-requests/intake-tokens', { branchId }).then(unwrap);
  },
};
