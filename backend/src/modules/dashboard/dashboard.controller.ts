import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get Dashboard KPIs
   * GET /api/v1/dashboard/kpis
   */
  @Get('kpis')
  async getKPIs(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getKPIs(startDate, endDate);
  }

  /**
   * Get Revenue Trend
   * GET /api/v1/dashboard/revenue-trend
   */
  @Get('revenue-trend')
  async getRevenueTrend(
    @Query('days') days?: string,
    @Query('branchId') branchId?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getRevenueTrend(daysNum, branchId);
  }

  /**
   * Get Sales by Category
   * GET /api/v1/dashboard/sales-by-category
   */
  @Get('sales-by-category')
  async getSalesByCategory(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.dashboardService.getSalesByCategory(
      startDate,
      endDate,
      limitNum,
    );
  }

  /**
   * Get Top Products
   * GET /api/v1/dashboard/top-products
   */
  @Get('top-products')
  async getTopProducts(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getTopProducts(daysNum, limitNum);
  }

  /**
   * Get Branch Performance
   * GET /api/v1/dashboard/branch-performance
   */
  @Get('branch-performance')
  async getBranchPerformance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getBranchPerformance(startDate, endDate);
  }

  /**
   * Get Recent Transactions
   * GET /api/v1/dashboard/recent-transactions
   */
  @Get('recent-transactions')
  async getRecentTransactions(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getRecentTransactions(limitNum);
  }

  /**
   * Get Pending Approvals
   * GET /api/v1/dashboard/pending-approvals
   */
  @Get('pending-approvals')
  async getPendingApprovals() {
    return this.dashboardService.getPendingApprovals();
  }

  // ============================================
  // SALES DASHBOARD ENDPOINTS
  // ============================================

  /**
   * Get Sales KPIs
   * GET /api/v1/dashboard/sales/kpis
   */
  @Get('sales/kpis')
  async getSalesKPIs(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getSalesKPIs(startDate, endDate);
  }

  /**
   * Get Hourly Sales
   * GET /api/v1/dashboard/sales/hourly
   */
  @Get('sales/hourly')
  async getHourlySales(@Query('date') date?: string) {
    return this.dashboardService.getHourlySales(date);
  }

  /**
   * Get Daily Sales Comparison
   * GET /api/v1/dashboard/sales/daily
   */
  @Get('sales/daily')
  async getDailySales(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getDailySales(daysNum);
  }

  /**
   * Get Sales by Payment Method
   * GET /api/v1/dashboard/sales/payment-method
   */
  @Get('sales/payment-method')
  async getSalesByPaymentMethod(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getSalesByPaymentMethod(startDate, endDate);
  }

  /**
   * Get Sales by Customer Type
   * GET /api/v1/dashboard/sales/customer-type
   */
  @Get('sales/customer-type')
  async getSalesByCustomerType(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getSalesByCustomerType(startDate, endDate);
  }

  /**
   * Get Top Customers
   * GET /api/v1/dashboard/sales/top-customers
   */
  @Get('sales/top-customers')
  async getTopCustomers(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getTopCustomers(limitNum);
  }

  /**
   * Get Sales by Cashier
   * GET /api/v1/dashboard/sales/cashier
   */
  @Get('sales/cashier')
  async getSalesByCashier(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getSalesByCashier(startDate, endDate);
  }

  // ============================================
  // INVENTORY DASHBOARD ENDPOINTS
  // ============================================

  /**
   * Get Inventory KPIs
   * GET /api/v1/dashboard/inventory/kpis
   */
  @Get('inventory/kpis')
  async getInventoryKPIs() {
    return this.dashboardService.getInventoryKPIs();
  }

  /**
   * Get Stock Status by Branch
   * GET /api/v1/dashboard/inventory/stock-by-branch
   */
  @Get('inventory/stock-by-branch')
  async getStockStatusByBranch() {
    return this.dashboardService.getStockStatusByBranch();
  }

  /**
   * Get Stock Movement
   * GET /api/v1/dashboard/inventory/movement
   */
  @Get('inventory/movement')
  async getStockMovement(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getStockMovement(daysNum);
  }

  /**
   * Get Top Moving Products
   * GET /api/v1/dashboard/inventory/top-moving
   */
  @Get('inventory/top-moving')
  async getTopMovingProducts(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getTopMovingProducts(daysNum, limitNum);
  }

  /**
   * Get Low Stock Alerts
   * GET /api/v1/dashboard/inventory/low-stock
   */
  @Get('inventory/low-stock')
  async getLowStockAlerts() {
    return this.dashboardService.getLowStockAlerts();
  }

  /**
   * Get Pending Transfers
   * GET /api/v1/dashboard/inventory/pending-transfers
   */
  @Get('inventory/pending-transfers')
  async getPendingTransfers() {
    return this.dashboardService.getPendingTransfers();
  }

  /**
   * Get Slow Moving Items
   * GET /api/v1/dashboard/inventory/slow-moving
   */
  @Get('inventory/slow-moving')
  async getSlowMovingItems(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 90;
    return this.dashboardService.getSlowMovingItems(daysNum);
  }

  // ============================================
  // SERVICE DASHBOARD ENDPOINTS
  // ============================================

  /**
   * Get Service KPIs
   * GET /api/v1/dashboard/service/kpis
   */
  @Get('service/kpis')
  async getServiceKPIs() {
    return this.dashboardService.getServiceKPIs();
  }

  /**
   * Get Service Pipeline
   * GET /api/v1/dashboard/service/pipeline
   */
  @Get('service/pipeline')
  async getServicePipeline() {
    return this.dashboardService.getServicePipeline();
  }

  /**
   * Get Service Types Distribution
   * GET /api/v1/dashboard/service/types
   */
  @Get('service/types')
  async getServiceTypesDistribution(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getServiceTypesDistribution(startDate, endDate);
  }

  /**
   * Get Workload by Technician
   * GET /api/v1/dashboard/service/workload
   */
  @Get('service/workload')
  async getWorkloadByTechnician() {
    return this.dashboardService.getWorkloadByTechnician();
  }

  /**
   * Get Performance Metrics
   * GET /api/v1/dashboard/service/performance
   */
  @Get('service/performance')
  async getPerformanceMetrics(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getPerformanceMetrics(daysNum);
  }

  /**
   * Get Overdue Services
   * GET /api/v1/dashboard/service/overdue
   */
  @Get('service/overdue')
  async getOverdueServices() {
    return this.dashboardService.getOverdueServices();
  }

  /**
   * Get Most Used Parts
   * GET /api/v1/dashboard/service/most-used-parts
   */
  @Get('service/most-used-parts')
  async getMostUsedParts(
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getMostUsedParts(daysNum, limitNum);
  }

  /**
   * Get SLA Compliance
   * GET /api/v1/dashboard/service/sla-compliance
   */
  @Get('service/sla-compliance')
  async getSLACompliance() {
    return this.dashboardService.getSLACompliance();
  }
}

