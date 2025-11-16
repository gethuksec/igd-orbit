import { api, handleApiError } from './api';

// Employees
export interface Employee {
  id: string;
  employeeNumber: string;
  userId?: string;
  user?: { id: string; username: string; email: string; fullName: string };
  branchId: string;
  branch?: { id: string; name: string; code: string };
  departmentId?: string;
  department?: { id: string; name: string };
  position: string;
  hireDate: string;
  basicSalary: number;
  status: 'active' | 'inactive' | 'terminated';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeListResponse {
  data: Employee[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Attendance
export interface Attendance {
  id: string;
  employeeId: string;
  employee?: Employee;
  date: string;
  clockIn?: string;
  clockOut?: string;
  breakStart?: string;
  breakEnd?: string;
  totalHours: number;
  status: 'present' | 'absent' | 'late' | 'half-day' | 'leave';
  isManual: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceListResponse {
  data: Attendance[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Leave
export interface LeaveRequest {
  id: string;
  leaveNumber: string;
  employeeId: string;
  employee?: Employee;
  leaveType: 'annual' | 'sick' | 'personal' | 'unpaid';
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalance {
  leaveType: string;
  total: number;
  used: number;
  remaining: number;
}

export interface LeaveListResponse {
  data: LeaveRequest[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Payroll
export interface Payroll {
  id: string;
  payrollNumber: string;
  employeeId: string;
  employee?: Employee;
  periodMonth: number;
  periodYear: number;
  basicSalary: number;
  allowances: PayrollComponent[];
  deductions: PayrollComponent[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  status: 'draft' | 'calculated' | 'approved' | 'paid';
  calculatedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollComponent {
  id: string;
  componentType: 'allowance' | 'deduction';
  componentName: string;
  amount: number;
  isTaxable: boolean;
}

export interface PayrollListResponse {
  data: Payroll[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// KPI
export interface KPI {
  id: string;
  employeeId: string;
  employee?: Employee;
  periodMonth: number;
  periodYear: number;
  targetScore: number;
  actualScore: number;
  achievement: number;
  status: 'draft' | 'submitted' | 'reviewed' | 'approved';
  metrics: KPIMetric[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KPIMetric {
  id: string;
  metricName: string;
  target: number;
  actual: number;
  weight: number;
  score: number;
}

export interface KPIListResponse {
  data: KPI[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const hrService = {
  // Employees
  async getEmployees(params?: {
    page?: number;
    limit?: number;
    search?: string;
    branchId?: string;
    departmentId?: string;
    status?: string;
  }): Promise<EmployeeListResponse> {
    try {
      const response = await api.get('/employees', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getEmployeeById(id: string): Promise<Employee> {
    try {
      const response = await api.get(`/employees/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createEmployee(data: {
    userId?: string;
    branchId: string;
    departmentId?: string;
    position: string;
    hireDate: string;
    basicSalary: number;
  }): Promise<Employee> {
    try {
      const response = await api.post('/employees', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async updateEmployee(id: string, data: Partial<Employee>): Promise<Employee> {
    try {
      const response = await api.put(`/employees/${id}`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Attendance
  async getAttendance(params?: {
    page?: number;
    limit?: number;
    employeeId?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<AttendanceListResponse> {
    try {
      const response = await api.get('/attendance', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async clockIn(data: { branch_id: string; clock_in_time?: string; notes?: string }): Promise<Attendance> {
    try {
      const response = await api.post('/attendance/clock-in', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async clockOut(data: { clock_out_time?: string; notes?: string }): Promise<Attendance> {
    try {
      const response = await api.post('/attendance/clock-out', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async manualAdjustment(data: {
    employeeId: string;
    date: string;
    clockIn?: string;
    clockOut?: string;
    status: string;
    notes?: string;
  }): Promise<Attendance> {
    try {
      const response = await api.post('/attendance/manual', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Leave
  async getLeaveRequests(params?: {
    page?: number;
    limit?: number;
    employeeId?: string;
    status?: string;
    leaveType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<LeaveListResponse> {
    try {
      const response = await api.get('/leave', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getLeaveBalance(employeeId: string): Promise<LeaveBalance[]> {
    try {
      const response = await api.get(`/leave/balance/${employeeId}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createLeaveRequest(data: {
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
  }): Promise<LeaveRequest> {
    try {
      const response = await api.post('/leave', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async approveLeave(id: string, data: { notes?: string }): Promise<LeaveRequest> {
    try {
      const response = await api.put(`/leave/${id}/approve`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async rejectLeave(id: string, data: { reason: string }): Promise<LeaveRequest> {
    try {
      const response = await api.put(`/leave/${id}/reject`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // Payroll
  async getPayrolls(params?: {
    page?: number;
    limit?: number;
    employeeId?: string;
    periodMonth?: number;
    periodYear?: number;
    status?: string;
  }): Promise<PayrollListResponse> {
    try {
      const response = await api.get('/payroll', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getPayrollById(id: string): Promise<Payroll> {
    try {
      const response = await api.get(`/payroll/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async calculatePayroll(data: {
    employeeIds?: string[];
    periodMonth: number;
    periodYear: number;
    branchId?: string;
  }): Promise<Payroll[]> {
    try {
      const response = await api.post('/payroll/calculate', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async approvePayroll(id: string, data?: { notes?: string }): Promise<Payroll> {
    try {
      const response = await api.put(`/payroll/${id}/approve`, data || {});
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  // KPI
  async getKPIs(params?: {
    page?: number;
    limit?: number;
    employeeId?: string;
    periodMonth?: number;
    periodYear?: number;
    status?: string;
  }): Promise<KPIListResponse> {
    try {
      const response = await api.get('/kpi', { params });
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        data: [],
        meta: { page: params?.page || 1, limit: params?.limit || 20, total: 0, totalPages: 0 },
      });
    }
  },

  async getKPIById(id: string): Promise<KPI> {
    try {
      const response = await api.get(`/kpi/${id}`);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async createKPI(data: {
    employeeId: string;
    periodMonth: number;
    periodYear: number;
    targetScore: number;
    metrics: Array<{ metricName: string; target: number; weight: number }>;
    notes?: string;
  }): Promise<KPI> {
    try {
      const response = await api.post('/kpi', data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },

  async updateKPIScore(id: string, data: {
    metricId: string;
    actual: number;
  }): Promise<KPI> {
    try {
      const response = await api.put(`/kpi/${id}/score`, data);
      return response.data.data || response.data;
    } catch (error: any) {
      throw error;
    }
  },
};

