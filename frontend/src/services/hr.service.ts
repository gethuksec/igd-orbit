import { api } from './api';

// ============================================
// Interfaces
// ============================================

export interface Employee {
  id: string;
  userId: string;
  employeeCode: string;
  branchId?: string;
  departmentId?: string;
  position?: string;
  hireDate?: string;
  employmentType?: 'full-time' | 'part-time' | 'contract';
  basicSalary?: number;
  hourlyRate?: number;
  bankAccount?: string;
  bankName?: string;
  taxId?: string;
  bpjsNumber?: string;
  isActive: boolean;
  user?: {
    id: string;
    email: string;
    fullName?: string;
    phone?: string;
  };
  branch?: {
    id: string;
    name: string;
    code: string;
  };
  department?: {
    id: string;
    name: string;
  };
}

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  branchId: string;
  clockIn?: string;
  clockOut?: string;
  clockInMethod?: 'fingerprint' | 'manual' | 'mobile';
  clockOutMethod?: 'fingerprint' | 'manual' | 'mobile';
  clockInLocation?: string;
  clockOutLocation?: string;
  clockInPhotoUrl?: string;
  clockOutPhotoUrl?: string;
  clockInLat?: number;
  clockInLng?: number;
  clockOutLat?: number;
  clockOutLng?: number;
  status: 'present' | 'absent' | 'leave' | 'holiday';
  isLate: boolean;
  lateMinutes: number;
  isEarlyLeave: boolean;
  earlyLeaveMinutes: number;
  totalHours?: number;
  breakTime?: number;
  overtimeHours?: number;
  overtimeApproved: boolean;
  notes?: string;
  employee?: Employee;
  branch?: {
    id: string;
    name: string;
  };
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveType: string;
  leaveTypeId?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  attachmentUrl?: string;
  status: 'pending' | 'manager_approved' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  employee?: Employee;
}

export interface LeaveBalance {
  annual: {
    quota: number;
    used: number;
    remaining: number;
  };
  sick: {
    quota: number;
    used: number;
    remaining: number;
  };
  emergency: {
    quota: number;
    used: number;
    remaining: number;
  };
  unpaid: {
    used: number;
  };
}

export interface Payroll {
  id: string;
  employeeId: string;
  periodMonth: number;
  periodYear: number;
  payrollNumber: string;
  status: 'draft' | 'approved' | 'paid' | 'cancelled';
  totalEarnings: number;
  totalDeductions: number;
  nettSalary: number;
  attendanceDays: number;
  lateCount: number;
  lateMinutes: number;
  earlyLeaveCount: number;
  absenceCount: number;
  overtimeHours: number;
  unpaidLeaveDays: number;
  calculatedBy: string;
  calculatedAt: string;
  approvedBy?: string;
  approvedBy2?: string;
  approvedAt?: string;
  processedBy?: string;
  processedAt?: string;
  payslipUrl?: string;
  notes?: string;
  employee?: Employee;
  components?: PayrollComponent[];
}

export interface PayrollComponent {
  id: string;
  payrollId: string;
  componentType: 'earning' | 'deduction';
  componentName: string;
  amount: number;
  isTaxable: boolean;
  notes?: string;
}

export interface KPIRecord {
  id: string;
  employeeId: string;
  periodMonth: number;
  periodYear: number;
  salesTargetAchievement?: number;
  serviceQualityScore?: number;
  customerSatisfaction?: number;
  attendanceScore?: number;
  overallScore: number;
  targetBonus?: number;
  calculatedBonus?: number;
  bonusMultiplier?: number;
  recordedBy: string;
  notes?: string;
  employee?: Employee;
}

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  lateCount: number;
  earlyLeaveCount: number;
  totalHours: number;
  overtimeHours: number;
}

// IGDERP-275: unified approvals inbox item
export interface PendingApproval {
  kind: 'leave' | 'overtime' | 'shift_swap' | 'libur';
  id: string;
  status: string;
  createdAt: string;
  requester: { employeeId: string; name: string | null; nik: string | null; employeeCode: string };
  summary: string;
  canDecide: boolean;
  decideEndpoint: string;
}

export interface ShiftSwapRequest {
  id: string;
  employeeId: string;
  targetEmployeeId: string;
  date: string;
  fromShiftId: string;
  toShiftId: string;
  reason?: string;
  status: 'pending' | 'manager_approved' | 'approved' | 'rejected' | 'cancelled';
  employee?: Employee;
  targetEmployee?: Employee;
  fromShift?: { id: string; name: string };
  toShift?: { id: string; name: string };
}

// ============================================
// Service Methods
// ============================================

export const hrService = {
  // ============================================
  // Attendance
  // ============================================

  /**
   * Clock in (IGDERP-275: method 'mobile' requires latitude/longitude/photoUrl)
   */
  async clockIn(data: { branch_id: string; method?: 'fingerprint' | 'manual' | 'mobile'; clock_in_location?: string; latitude?: number; longitude?: number; photoUrl?: string; notes?: string }) {
    const response = await api.post('/attendance/clock-in', data);
    return response.data.data || response.data;
  },

  /**
   * Clock out (IGDERP-275: method 'mobile' requires latitude/longitude/photoUrl)
   */
  async clockOut(data: { branch_id: string; method?: 'fingerprint' | 'manual' | 'mobile'; clock_out_location?: string; latitude?: number; longitude?: number; photoUrl?: string; notes?: string }) {
    const response = await api.post('/attendance/clock-out', data);
    return response.data.data || response.data;
  },

  /**
   * Selfie upload for mobile clock in/out → { url }
   */
  async uploadSelfie(file: File | Blob): Promise<{ url: string }> {
    const form = new FormData();
    form.append('photo', file);
    const response = await api.post('/attendance/selfie', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data || response.data;
  },

  /**
   * Leave supporting-document upload → { url }
   */
  async uploadLeaveAttachment(file: File | Blob): Promise<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post('/leave/attachment', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data || response.data;
  },

  /**
   * List attendance records
   */
  async getAttendances(params?: {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    status?: string;
    branchId?: string;
  }): Promise<{ data: Attendance[]; total: number }> {
    const response = await api.get('/attendance', { params });
    // Backend returns { data: [], total: number } or array directly
    if (Array.isArray(response.data)) {
      return { data: response.data, total: response.data.length };
    }
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return {
        data: response.data.data || [],
        total: response.data.total || (response.data.data?.length || 0),
      };
    }
    return { data: [], total: 0 };
  },

  /**
   * Get monthly summary
   */
  async getAttendanceSummary(month: number, year: number): Promise<AttendanceSummary> {
    const response = await api.get('/attendance/summary', {
      params: { month, year },
    });
    return response.data.data || response.data;
  },

  /**
   * Manual adjustment
   */
  async adjustAttendance(id: string, data: { clock_in?: string; clock_out?: string; status?: string; notes?: string; reason: string }) {
    const response = await api.post(`/attendance/${id}/adjust`, data);
    return response.data.data || response.data;
  },

  /**
   * Request overtime
   */
  async requestOvertime(data: { attendance_id: string; requested_hours: number; reason: string; requested_date: string }) {
    const response = await api.post('/attendance/overtime/request', data);
    return response.data.data || response.data;
  },

  /**
   * Approve overtime
   */
  async approveOvertime(overtimeId: string) {
    const response = await api.post('/attendance/overtime/approve', null, {
      params: { id: overtimeId },
    });
    return response.data.data || response.data;
  },

  /**
   * Reject overtime
   */
  async rejectOvertime(overtimeId: string, reason: string) {
    const response = await api.post('/attendance/overtime/reject', { reason }, {
      params: { id: overtimeId },
    });
    return response.data.data || response.data;
  },

  /**
   * Approve overtime — step 2 / final (CHR)
   */
  async approveOvertimeHr(overtimeId: string) {
    const response = await api.post('/attendance/overtime/approve-hr', null, {
      params: { id: overtimeId },
    });
    return response.data.data || response.data;
  },

  // ============================================
  // Leave
  // ============================================

  /**
   * Request leave
   */
  async requestLeave(data: {
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
    attachment_url?: string;
  }) {
    const response = await api.post('/leave/request', data);
    return response.data.data || response.data;
  },

  /**
   * List leave requests
   */
  async getLeaveRequests(params?: {
    employeeId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: LeaveRequest[]; total: number }> {
    const response = await api.get('/leave/requests', { params });
    // Backend returns { data: [], total: number } or array directly
    if (Array.isArray(response.data)) {
      return { data: response.data, total: response.data.length };
    }
    // If it's an object with data property
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return {
        data: response.data.data || [],
        total: response.data.total || (response.data.data?.length || 0)
      };
    }
    // Fallback
    return { data: [], total: 0 };
  },

  /**
   * Get leave balance
   */
  async getLeaveBalance(userId: string): Promise<LeaveBalance> {
    const response = await api.get(`/leave/balance/${userId}`);
    return response.data.data || response.data;
  },

  /**
   * Approve leave
   */
  async approveLeave(leaveId: string, data: { notes?: string }) {
    const response = await api.post('/leave/approve', data, {
      params: { id: leaveId },
    });
    return response.data.data || response.data;
  },

  /**
   * Approve leave — step 2 / final (CHR)
   */
  async approveLeaveHr(leaveId: string) {
    const response = await api.post('/leave/approve-hr', null, {
      params: { id: leaveId },
    });
    return response.data.data || response.data;
  },

  /**
   * Reject leave
   */
  async rejectLeave(leaveId: string, data: { reason: string; notes?: string }) {
    const response = await api.post('/leave/reject', data, {
      params: { id: leaveId },
    });
    return response.data.data || response.data;
  },

  /**
   * Cancel leave
   */
  async cancelLeave(leaveId: string, data: { reason: string }) {
    const response = await api.post('/leave/cancel', data, {
      params: { id: leaveId },
    });
    return response.data.data || response.data;
  },

  // ============================================
  // Payroll
  // ============================================

  /**
   * Calculate payroll
   */
  async calculatePayroll(data: {
    employee_ids?: string[];
    period_month: number;
    period_year: number;
    components?: Array<{
      component_type: 'earning' | 'deduction';
      component_name: string;
      amount: number;
      is_taxable?: boolean;
      notes?: string;
    }>;
  }) {
    const response = await api.post('/payroll/calculate', data);
    return response.data.data || response.data;
  },

  /**
   * List payroll records
   */
  async getPayrolls(params?: {
    employeeId?: string;
    periodMonth?: number;
    periodYear?: number;
    status?: string;
  }): Promise<{ data: Payroll[]; total: number }> {
    const response = await api.get('/payroll', { params });
    // Backend returns { data: [], total: number } or array directly
    if (Array.isArray(response.data)) {
      return { data: response.data, total: response.data.length };
    }
    // If it's an object with data property
    if (response.data && typeof response.data === 'object' && 'data' in response.data) {
      return { 
        data: response.data.data || [], 
        total: response.data.total || (response.data.data?.length || 0) 
      };
    }
    // Fallback
    return { data: [], total: 0 };
  },

  /**
   * Get payroll detail
   */
  async getPayroll(id: string): Promise<Payroll> {
    const response = await api.get(`/payroll/${id}`);
    return response.data.data || response.data;
  },

  /**
   * Approve payroll
   */
  async approvePayroll(id: string) {
    const response = await api.post(`/payroll/${id}/approve`);
    return response.data.data || response.data;
  },

  /**
   * Process payment
   */
  async processPayment(id: string) {
    const response = await api.post(`/payroll/${id}/process`);
    return response.data;
  },

  /**
   * Cancel payroll
   */
  async cancelPayroll(id: string, reason?: string) {
    const response = await api.post(`/payroll/${id}/cancel`, { reason });
    return response.data.data || response.data;
  },

  /**
   * Generate payslip
   */
  async generatePayslip(id: string): Promise<{ payslipUrl: string }> {
    const response = await api.get(`/payroll/${id}/slip`);
    return response.data.data || response.data;
  },

  // ============================================
  // IGDERP-275: employee self-service (PWA)
  // ============================================

  /**
   * Unified pending-approvals inbox (dashboard + HP)
   */
  async getPendingApprovals(): Promise<{ data: PendingApproval[]; total: number; awaitingDecision: number }> {
    const response = await api.get('/approvals/pending');
    return response.data.data || response.data;
  },

  /**
   * Set or change own payslip PIN
   */
  async setPayslipPin(data: { pin: string; oldPin?: string }) {
    const response = await api.post('/payroll/pin', data);
    return response.data.data || response.data;
  },

  /**
   * List own payslips (PIN-gated)
   */
  async getMySlips(pin: string) {
    const response = await api.post('/payroll/my-slips', { pin });
    return response.data.data || response.data;
  },

  /**
   * Open own payslip detail (PIN-gated)
   */
  async unlockSlip(id: string, pin: string): Promise<Payroll> {
    const response = await api.post(`/payroll/${id}/unlock`, { pin });
    return response.data.data || response.data;
  },

  /**
   * File a shift swap request (tukar shift)
   */
  async requestShiftSwap(data: { target_employee_id: string; date: string; from_shift_id: string; to_shift_id: string; reason?: string }) {
    const response = await api.post('/shift-swap/request', data);
    return response.data.data || response.data;
  },

  /**
   * List shift swap requests
   */
  async getShiftSwaps(params?: { employeeId?: string; status?: string }): Promise<{ data: ShiftSwapRequest[]; total: number }> {
    const response = await api.get('/shift-swap/requests', { params });
    if (Array.isArray(response.data)) return { data: response.data, total: response.data.length };
    return { data: response.data?.data || [], total: response.data?.total || 0 };
  },

  /**
   * Approve shift swap — step 1 (HS/SPV)
   */
  async approveShiftSwap(id: string) {
    const response = await api.post('/shift-swap/approve', null, { params: { id } });
    return response.data.data || response.data;
  },

  /**
   * Approve shift swap — step 2 / final (CHR)
   */
  async approveShiftSwapHr(id: string) {
    const response = await api.post('/shift-swap/approve-hr', null, { params: { id } });
    return response.data.data || response.data;
  },

  /**
   * Reject shift swap
   */
  async rejectShiftSwap(id: string, reason: string) {
    const response = await api.post('/shift-swap/reject', { reason }, { params: { id } });
    return response.data.data || response.data;
  },

  /**
   * Cancel own shift swap request
   */
  async cancelShiftSwap(id: string) {
    const response = await api.post('/shift-swap/cancel', null, { params: { id } });
    return response.data.data || response.data;
  },

  // ============================================
  // KPI
  // ============================================

  /**
   * Record KPI
   */
  async recordKPI(data: {
    employee_id: string;
    period_month: number;
    period_year: number;
    sales_target_achievement?: number;
    service_quality_score?: number;
    customer_satisfaction?: number;
    attendance_score?: number;
    target_bonus?: number;
    bonus_multiplier?: number;
    notes?: string;
  }) {
    const response = await api.post('/kpi/records', data);
    return response.data.data || response.data;
  },

  /**
   * Get employee KPIs
   */
  async getEmployeeKPIs(userId: string, params?: { month?: number; year?: number }): Promise<{ data: KPIRecord[]; total: number }> {
    const response = await api.get(`/kpi/records/${userId}`, { params });
    return response.data.data || response.data;
  },

  /**
   * Get KPI record by ID
   */
  async getKPI(id: string): Promise<KPIRecord> {
    const response = await api.get(`/kpi/records/${id}`);
    return response.data.data || response.data;
  },

  /**
   * Update KPI score
   */
  async updateKPIScore(id: string, data: {
    sales_target_achievement?: number;
    service_quality_score?: number;
    customer_satisfaction?: number;
    attendance_score?: number;
    overall_score?: number;
    calculated_bonus?: number;
    notes?: string;
  }) {
    const response = await api.post(`/kpi/records/${id}/score`, data);
    return response.data.data || response.data;
  },
};
