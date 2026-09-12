// ─── Service Module Types (E-FE Smart Repair) ───────────────────────────────

export interface ServiceCheckpoint {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ServiceCheckpointListResponse {
  data: ServiceCheckpoint[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface CompletenessItem {
  checkpointId?: string;
  name: string;
  checked: boolean;
  conditionNote?: string;
}

export interface ServicePartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  purchaseType?: 'internal' | 'external';
  warrantyDays?: number;
  warehouseId?: string;
  notes?: string;
}

export interface SmartRepairPayload {
  branchId?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerSubdistrict?: string;

  deviceType: 'handphone' | 'laptop' | 'tablet' | 'other';
  deviceUnit?: string;
  deviceColor?: string;
  deviceSerial?: string;
  devicePassword?: string;
  deviceLockType?: 'none' | 'password' | 'pin' | 'pattern';
  deviceCondition?: string;

  complaint: string;
  initialDiagnosis?: string;
  serviceSubType: 'quick' | 'inap';
  assignedTechnicianId?: string;
  layananIds?: string[];
  layananItems?: Array<{ serviceTypeId: string; estimatedCost?: number; notes?: string }>;

  estimatedCost?: number;
  quotedPrice?: number;
  finalPrice?: number;
  priority?: 'normal' | 'urgent';
  receivedDate?: string;
  promisedDate?: string;

  warehouseId?: string;
  taxPpn: boolean;
  taxIncPpn: boolean;
  taxPph22: boolean;
  taxPph23: boolean;
  downPayment?: number;
  warrantyDays?: number;
  laborCost?: number;
  otherCost?: number;
  parts?: ServicePartItem[];
  completenessItems?: CompletenessItem[];

  customerNotes?: string;
  internalNotes?: string;
}
