// ─── Service Module Types (E-FE Smart Repair) ───────────────────────────────

/** Kelengkapan master data item (ServiceCheckpoint) */
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
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** One row of the kelengkapan checklist on a service order (JSONB snapshot) */
export interface CompletenessItem {
  checkpointId?: string;
  name: string;
  checked: boolean;
  conditionNote?: string;
}

/** Spare part line item on a service order (ServicePartsUsed) */
export interface ServicePartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  purchaseType?: 'internal' | 'external';
  notes?: string;
}

/** Smart Repair service order create payload (matches CreateServiceOrderDto) */
export interface SmartRepairPayload {
  customerId?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerSubdistrict?: string;

  deviceType: 'handphone' | 'laptop' | 'tablet' | 'other';
  deviceUnit?: string;
  deviceSerial?: string;
  deviceCondition?: string;

  complaint: string;
  initialDiagnosis?: string;
  serviceSubType: 'quick' | 'inap';
  assignedTechnicianId?: string;

  estimatedCost?: number;
  quotedPrice?: number;
  finalPrice?: number;
  priority?: 'normal' | 'urgent';
  promisedDate?: string;

  warehouseId?: string;
  taxPpn: boolean;
  taxIncPpn: boolean;
  taxPph22: boolean;
  taxPph23: boolean;
  downPayment?: number;
  laborCost?: number;
  otherCost?: number;
  parts?: ServicePartItem[];
  completenessItems?: CompletenessItem[];

  customerNotes?: string;
  internalNotes?: string;
}
