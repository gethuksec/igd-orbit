import { api, handleApiError } from './api';

export interface DashboardKPIs {
  todayRevenue: number;
  yesterdayRevenue: number;
  totalTransactions: number;
  yesterdayTransactions: number;
  activeServices: number;
  pendingServices: number;
  overdueServices: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalCustomers: number;
}

export interface RevenueTrend {
  date: string;
  sales: number;
  service: number;
  total: number;
}

export interface SalesByCategory {
  category: string;
  amount: number;
  percentage: number;
}

export interface TopProduct {
  rank: number;
  productName: string;
  quantitySold: number;
  revenue: number;
}

export interface BranchPerformance {
  branchName: string;
  revenue: number;
  transactionCount: number;
  averageTicketSize: number;
}

export interface RecentTransaction {
  id: string;
  time: string;
  customer: string;
  amount: number;
  status: string;
}

export interface PendingApproval {
  id: string;
  type: 'expense' | 'transfer' | 'return';
  requester: string;
  amount: number;
}

export const dashboardService = {
  async getKPIs(
    dateRange?: { startDate: string; endDate: string; branchId?: string },
  ): Promise<DashboardKPIs> {
    try {
      const params = new URLSearchParams();
      if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange?.endDate) params.append('endDate', dateRange.endDate);
      if (dateRange?.branchId) params.append('branchId', dateRange.branchId);
      const query = params.toString();
      const response = await api.get(`/dashboard/kpis${query ? `?${query}` : ''}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        todayRevenue: 0,
        yesterdayRevenue: 0,
        totalTransactions: 0,
        yesterdayTransactions: 0,
        activeServices: 0,
        pendingServices: 0,
        overdueServices: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        totalCustomers: 0,
      });
    }
  },

  async getRevenueTrend(
    days: number = 30,
    branchId?: string,
  ): Promise<RevenueTrend[]> {
    try {
      const params = new URLSearchParams();
      params.append('days', days.toString());
      if (branchId) params.append('branchId', branchId);
      const response = await api.get(`/dashboard/revenue-trend?${params}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getSalesByCategory(
    paramsInput?: { startDate: string; endDate: string; branchId?: string },
    limit: number = 5,
  ): Promise<SalesByCategory[]> {
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      if (paramsInput?.startDate) params.append('startDate', paramsInput.startDate);
      if (paramsInput?.endDate) params.append('endDate', paramsInput.endDate);
      if (paramsInput?.branchId) params.append('branchId', paramsInput.branchId);
      const response = await api.get(`/dashboard/sales-by-category?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getTopProducts(
    days: number = 30,
    limit: number = 10,
    branchId?: string,
  ): Promise<TopProduct[]> {
    try {
      const params = new URLSearchParams();
      params.append('days', days.toString());
      params.append('limit', limit.toString());
      if (branchId) params.append('branchId', branchId);
      const response = await api.get(`/dashboard/top-products?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getBranchPerformance(
    dateRange?: { startDate: string; endDate: string; branchId?: string },
  ): Promise<BranchPerformance[]> {
    try {
      const params = new URLSearchParams();
      if (dateRange?.startDate) params.append('startDate', dateRange.startDate);
      if (dateRange?.endDate) params.append('endDate', dateRange.endDate);
      if (dateRange?.branchId) params.append('branchId', dateRange.branchId);
      const query = params.toString();
      const response = await api.get(
        `/dashboard/branch-performance${query ? `?${query}` : ''}`,
      );
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getRecentTransactions(
    limit: number = 10,
    branchId?: string,
  ): Promise<RecentTransaction[]> {
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      if (branchId) params.append('branchId', branchId);
      const response = await api.get(`/dashboard/recent-transactions?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getPendingApprovals(): Promise<PendingApproval[]> {
    try {
      const response = await api.get('/dashboard/pending-approvals');
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  // ============================================
  // SALES DASHBOARD
  // ============================================

  async getSalesKPIs(
    dateRange?: { startDate: string; endDate: string },
  ): Promise<{
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    conversionRate: number;
  }> {
    try {
      const params = dateRange
        ? `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        : '';
      const response = await api.get(`/dashboard/sales/kpis${params}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        totalSales: 0,
        totalOrders: 0,
        averageOrderValue: 0,
        conversionRate: 0,
      });
    }
  },

  async getHourlySales(date?: string): Promise<Array<{ hour: string; sales: number }>> {
    try {
      const params = date ? `?date=${date}` : '';
      const response = await api.get(`/dashboard/sales/hourly${params}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getDailySales(days: number = 30): Promise<
    Array<{ date: string; sales: number; lastMonth: number }>
  > {
    try {
      const response = await api.get(`/dashboard/sales/daily?days=${days}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getSalesByPaymentMethod(
    dateRange?: { startDate: string; endDate: string },
  ): Promise<Array<{ name: string; value: number; amount: number }>> {
    try {
      const params = dateRange
        ? `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        : '';
      const response = await api.get(`/dashboard/sales/payment-method${params}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getSalesByCustomerType(
    dateRange?: { startDate: string; endDate: string },
  ): Promise<Array<{ type: string; count: number; value: number }>> {
    try {
      const params = dateRange
        ? `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        : '';
      const response = await api.get(`/dashboard/sales/customer-type${params}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getTopCustomers(limit: number = 10): Promise<
    Array<{
      name: string;
      tier: string;
      orders: number;
      totalSpent: number;
      lifetimeValue: number;
    }>
  > {
    try {
      const response = await api.get(`/dashboard/sales/top-customers?limit=${limit}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getSalesByCashier(
    dateRange?: { startDate: string; endDate: string },
  ): Promise<
    Array<{
      name: string;
      transactions: number;
      totalSales: number;
      averageTicket: number;
      rank: number;
    }>
  > {
    try {
      const params = dateRange
        ? `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        : '';
      const response = await api.get(`/dashboard/sales/cashier${params}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  // ============================================
  // INVENTORY DASHBOARD
  // ============================================

  async getInventoryKPIs(): Promise<{
    totalSKUs: number;
    totalStockValue: number;
    lowStockItems: number;
    outOfStockItems: number;
  }> {
    try {
      const response = await api.get('/dashboard/inventory/kpis');
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        totalSKUs: 0,
        totalStockValue: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
      });
    }
  },

  async getStockStatusByBranch(): Promise<
    Array<{ name: string; available: number; reserved: number; damaged: number }>
  > {
    try {
      const response = await api.get('/dashboard/inventory/stock-by-branch');
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getStockMovement(days: number = 30): Promise<
    Array<{ date: string; in: number; out: number }>
  > {
    try {
      const response = await api.get(`/dashboard/inventory/movement?days=${days}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getTopMovingProducts(
    days: number = 30,
    limit: number = 10,
  ): Promise<
    Array<{
      product: string;
      category: string;
      qtyIn: number;
      qtyOut: number;
      netChange: number;
      turnover: number;
    }>
  > {
    try {
      const response = await api.get(
        `/dashboard/inventory/top-moving?days=${days}&limit=${limit}`,
      );
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getLowStockAlerts(): Promise<
    Array<{
      product: string;
      currentQty: number;
      reorderPoint: number;
      lastOrderDate: string;
      suggestedQty: number;
    }>
  > {
    try {
      const response = await api.get('/dashboard/inventory/low-stock');
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getPendingTransfers(): Promise<
    Array<{ id: string; from: string; to: string; items: number; status: string }>
  > {
    try {
      const response = await api.get('/dashboard/inventory/pending-transfers');
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getSlowMovingItems(days: number = 90): Promise<
    Array<{ product: string; daysNoMovement: number; stockValue: number }>
  > {
    try {
      const response = await api.get(`/dashboard/inventory/slow-moving?days=${days}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  // ============================================
  // SERVICE DASHBOARD
  // ============================================

  async getServiceKPIs(): Promise<{
    activeServices: number;
    completedToday: number;
    averageTAT: number;
    customerRating: number;
  }> {
    try {
      const response = await api.get('/dashboard/service/kpis');
      return response.data;
    } catch (error: any) {
      return handleApiError(error, {
        activeServices: 0,
        completedToday: 0,
        averageTAT: 0,
        customerRating: 0,
      });
    }
  },

  async getServicePipeline(): Promise<Array<{ stage: string; count: number }>> {
    try {
      const response = await api.get('/dashboard/service/pipeline');
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getServiceTypesDistribution(
    dateRange?: { startDate: string; endDate: string },
  ): Promise<Array<{ type: string; count: number; revenue: number }>> {
    try {
      const params = dateRange
        ? `?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        : '';
      const response = await api.get(`/dashboard/service/types${params}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getWorkloadByTechnician(): Promise<
    Array<{
      name: string;
      active: number;
      completedToday: number;
      completedWeek: number;
      capacity: number;
    }>
  > {
    try {
      const response = await api.get('/dashboard/service/workload');
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getPerformanceMetrics(days: number = 30): Promise<
    Array<{
      name: string;
      completed: number;
      averageTAT: number;
      rating: number;
      rank: number;
    }>
  > {
    try {
      const response = await api.get(`/dashboard/service/performance?days=${days}`);
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getOverdueServices(): Promise<
    Array<{
      serviceNumber: string;
      customer: string;
      device: string;
      daysOverdue: number;
      assignedTo: string;
      priority: string;
    }>
  > {
    try {
      const response = await api.get('/dashboard/service/overdue');
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getMostUsedParts(
    days: number = 30,
    limit: number = 10,
  ): Promise<Array<{ part: string; qtyUsed: number; stockStatus: string }>> {
    try {
      const response = await api.get(
        `/dashboard/service/most-used-parts?days=${days}&limit=${limit}`,
      );
      return response.data;
    } catch (error: any) {
      return handleApiError(error, []);
    }
  },

  async getSLACompliance(): Promise<number> {
    try {
      const response = await api.get('/dashboard/service/sla-compliance');
      return response.data;
    } catch (error: any) {
      return handleApiError(error, 0);
    }
  },

};

