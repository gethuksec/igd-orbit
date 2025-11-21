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
  clockInMethod?: 'fingerprint' | 'manual';
  clockOutMethod?: 'fingerprint' | 'manual';
  clockInLocation?: string;
  clockOutLocation?: string;
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
  leaveType: 'annual' | 'sick' | 'emergency' | 'unpaid';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
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

// ============================================
// Service Methods
// ============================================

export const hrService = {
  // ============================================
  // Attendance
  // ============================================

  /**
   * Clock in
   */
  async clockIn(data: { branch_id: string; method?: 'fingerprint' | 'manual'; clock_in_location?: string; notes?: string }) {
    const response = await api.post('/attendance/clock-in', data);
    return response.data.data || response.data;
  },

  /**
   * Clock out
   */
  async clockOut(data: { branch_id: string; method?: 'fingerprint' | 'manual'; clock_out_location?: string; notes?: string }) {
    const response = await api.post('/attendance/clock-out', data);
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

  // ============================================
  // Leave
  // ============================================

  /**
   * Request leave
   */
  async requestLeave(data: {
    leave_type: 'annual' | 'sick' | 'emergency' | 'unpaid';
    start_date: string;
    end_date: string;
    reason: string;
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
