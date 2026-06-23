import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Param,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Helper to ensure user has access to requested branch (prevents IDOR).
   * Owner & CFO are considered global and can access all branches.
   */
  private ensureBranchAccess(req: Request & { user?: any }, branchId?: string) {
    if (!branchId) return;
    const user = req.user as any;
    if (!user) return;

    const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
    const isGlobalRole =
      roles.includes('SUPERADMIN') ||
      roles.includes('OWNER') ||
      roles.includes('CFO') ||
      (user.role?.code && ['SUPERADMIN', 'OWNER', 'CFO'].includes(user.role.code));

    if (isGlobalRole) return;

    const allowedBranchIds: string[] = Array.isArray(user.branchIds)
      ? user.branchIds
      : [];

    if (allowedBranchIds.length > 0 && !allowedBranchIds.includes(branchId)) {
      throw new ForbiddenException('You do not have access to this branch');
    }
  }

  /**
   * Get Dashboard KPIs
   * GET /api/v1/dashboard/kpis
   */
  @Get('kpis')
  @Roles('OWNER', 'CFO', 'CMO', 'CSO', 'CHR', 'MGR')
  async getKPIs(
    @Req() req: Request & { user?: any },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('branchId') branchId?: string,
  ) {
    this.ensureBranchAccess(req, branchId);
    return this.dashboardService.getKPIs(startDate, endDate, branchId);
  }

  /**
   * Get Revenue Trend
   * GET /api/v1/dashboard/revenue-trend
   */
  @Get('revenue-trend')
  @Roles('OWNER', 'CFO', 'CMO', 'CSO', 'CHR', 'MGR')
  async getRevenueTrend(
    @Req() req: Request & { user?: any },
    @Query('days') days?: string,
    @Query('branchId') branchId?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    this.ensureBranchAccess(req, branchId);
    return this.dashboardService.getRevenueTrend(daysNum, branchId);
  }

  /**
   * Get Sales by Category
   * GET /api/v1/dashboard/sales-by-category
   */
  @Get('sales-by-category')
  @Roles('OWNER', 'CFO', 'CMO', 'CSO', 'CHR', 'MGR')
  async getSalesByCategory(
    @Req() req: Request & { user?: any },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
    @Query('branchId') branchId?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    this.ensureBranchAccess(req, branchId);
    return this.dashboardService.getSalesByCategory(
      startDate,
      endDate,
      limitNum,
      branchId,
    );
  }

  /**
   * Get Top Products
   * GET /api/v1/dashboard/top-products
   */
  @Get('top-products')
  @Roles('OWNER', 'CFO', 'CMO', 'CSO', 'CHR', 'MGR')
  async getTopProducts(
    @Req() req: Request & { user?: any },
    @Query('days') days?: string,
    @Query('limit') limit?: string,
    @Query('branchId') branchId?: string,
  ) {
    const daysNum = days ? parseInt(days, 10) : 30;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    this.ensureBranchAccess(req, branchId);
    return this.dashboardService.getTopProducts(daysNum, limitNum, branchId);
  }

  /**
   * Get Branch Performance
   * GET /api/v1/dashboard/branch-performance
   */
  @Get('branch-performance')
  @Roles('OWNER', 'CFO', 'CMO', 'CSO', 'CHR', 'MGR')
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
  @Roles('OWNER', 'CFO', 'CMO', 'CSO', 'CHR', 'MGR')
  async getRecentTransactions(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getRecentTransactions(limitNum);
  }

  /**
   * Get Pending Approvals
   * GET /api/v1/dashboard/pending-approvals
   */
  @Get('pending-approvals')
  @Roles('OWNER', 'CFO', 'CMO', 'CSO', 'CHR', 'MGR')
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
  @Roles('OWNER', 'CFO', 'MGR', 'CS')
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
  @Roles('OWNER', 'CFO', 'MGR', 'CS')
  async getHourlySales(@Query('date') date?: string) {
    return this.dashboardService.getHourlySales(date);
  }

  /**
   * Get Daily Sales Comparison
   * GET /api/v1/dashboard/sales/daily
   */
  @Get('sales/daily')
  @Roles('OWNER', 'CFO', 'MGR', 'CS')
  async getDailySales(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getDailySales(daysNum);
  }

  /**
   * Get Sales by Payment Method
   * GET /api/v1/dashboard/sales/payment-method
   */
  @Get('sales/payment-method')
  @Roles('OWNER', 'CFO', 'MGR', 'CS')
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
  @Roles('OWNER', 'CFO', 'MGR', 'CS')
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
  @Roles('OWNER', 'CFO', 'MGR', 'CS')
  async getTopCustomers(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.dashboardService.getTopCustomers(limitNum);
  }

  /**
   * Get Sales by Cashier
   * GET /api/v1/dashboard/sales/cashier
   */
  @Get('sales/cashier')
  @Roles('OWNER', 'CFO', 'MGR')
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
  @Roles('OWNER', 'CFO', 'MGR')
  async getInventoryKPIs() {
    return this.dashboardService.getInventoryKPIs();
  }

  /**
   * Get Stock Status by Branch
   * GET /api/v1/dashboard/inventory/stock-by-branch
   */
  @Get('inventory/stock-by-branch')
  @Roles('OWNER', 'CFO', 'MGR')
  async getStockStatusByBranch() {
    return this.dashboardService.getStockStatusByBranch();
  }

  /**
   * Get Stock Movement
   * GET /api/v1/dashboard/inventory/movement
   */
  @Get('inventory/movement')
  @Roles('OWNER', 'CFO', 'MGR')
  async getStockMovement(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getStockMovement(daysNum);
  }

  /**
   * Get Top Moving Products
   * GET /api/v1/dashboard/inventory/top-moving
   */
  @Get('inventory/top-moving')
  @Roles('OWNER', 'CFO', 'MGR')
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
  @Roles('OWNER', 'CFO', 'MGR')
  async getLowStockAlerts() {
    return this.dashboardService.getLowStockAlerts();
  }

  /**
   * Get Pending Transfers
   * GET /api/v1/dashboard/inventory/pending-transfers
   */
  @Get('inventory/pending-transfers')
  @Roles('OWNER', 'CFO', 'MGR')
  async getPendingTransfers() {
    return this.dashboardService.getPendingTransfers();
  }

  /**
   * Get Slow Moving Items
   * GET /api/v1/dashboard/inventory/slow-moving
   */
  @Get('inventory/slow-moving')
  @Roles('OWNER', 'CFO', 'MGR')
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
  @Roles('OWNER', 'MGR', 'CS')
  async getServiceKPIs() {
    return this.dashboardService.getServiceKPIs();
  }

  /**
   * Get Service Pipeline
   * GET /api/v1/dashboard/service/pipeline
   */
  @Get('service/pipeline')
  @Roles('OWNER', 'MGR', 'CS')
  async getServicePipeline() {
    return this.dashboardService.getServicePipeline();
  }

  /**
   * Get Service Types Distribution
   * GET /api/v1/dashboard/service/types
   */
  @Get('service/types')
  @Roles('OWNER', 'MGR', 'CS')
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
  @Roles('OWNER', 'MGR')
  async getWorkloadByTechnician() {
    return this.dashboardService.getWorkloadByTechnician();
  }

  /**
   * Get Performance Metrics
   * GET /api/v1/dashboard/service/performance
   */
  @Get('service/performance')
  @Roles('OWNER', 'MGR')
  async getPerformanceMetrics(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getPerformanceMetrics(daysNum);
  }

  /**
   * Get Overdue Services
   * GET /api/v1/dashboard/service/overdue
   */
  @Get('service/overdue')
  @Roles('OWNER', 'MGR', 'CS')
  async getOverdueServices() {
    return this.dashboardService.getOverdueServices();
  }

  /**
   * Get Most Used Parts
   * GET /api/v1/dashboard/service/most-used-parts
   */
  @Get('service/most-used-parts')
  @Roles('OWNER', 'MGR', 'CS')
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
  @Roles('OWNER', 'MGR')
  async getSLACompliance() {
    return this.dashboardService.getSLACompliance();
  }

  /**
   * Create Custom Graph
   * POST /api/v1/dashboard/custom-graph
   */
  @Post('custom-graph')
  @Roles('OWNER', 'CFO', 'CMO', 'CSO', 'MGR')
  async createCustomGraph(@Body() body: any) {
    return this.dashboardService.createCustomGraph(body);
  }

  /**
   * Get Custom Graph Data
   * GET /api/v1/dashboard/custom-graph/data
   */
  @Get('custom-graph/data')
  @Roles('OWNER', 'CFO', 'CMO', 'CSO', 'MGR')
  async getCustomGraphData(
    @Query('tableName') tableName: string,
    @Query('dataFields') dataFields: string,
    @Query('groupBy') groupBy?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.dashboardService.getCustomGraphData(
      tableName,
      dataFields,
      groupBy,
      branchId,
    );
  }

  /**
   * Delete Custom Graph
   * DELETE /api/v1/dashboard/custom-graph/:id
   */
  @Delete('custom-graph/:id')
  @Roles('OWNER', 'CFO', 'CMO', 'CSO', 'MGR')
  async deleteCustomGraph(@Param('id') id: string) {
    return this.dashboardService.deleteCustomGraph(id);
  }
}

