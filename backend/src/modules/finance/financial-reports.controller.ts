import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { FinancialReportsService } from './services/financial-reports.service';

@Controller('financial-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialReportsController {
  constructor(
    private readonly financialReportsService: FinancialReportsService,
  ) {}

  /**
   * Get Trial Balance
   * GET /api/v1/financial-reports/trial-balance
   * Permissions: CFO, Owner, Finance Staff
   */
  @Get('trial-balance')
  @Roles('CFO', 'OWNER', 'FINANCE')
  async getTrialBalance(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financialReportsService.getTrialBalance(startDate, endDate);
  }

  /**
   * Get Profit & Loss (Income Statement)
   * GET /api/v1/financial-reports/profit-loss
   * Permissions: CFO, Owner, Finance Staff
   */
  @Get('profit-loss')
  @Roles('CFO', 'OWNER', 'FINANCE')
  async getProfitLoss(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financialReportsService.getProfitLoss(startDate, endDate);
  }

  /**
   * Get Balance Sheet
   * GET /api/v1/financial-reports/balance-sheet
   * Permissions: CFO, Owner, Finance Staff
   */
  @Get('balance-sheet')
  @Roles('CFO', 'OWNER', 'FINANCE')
  async getBalanceSheet(@Query('asOfDate') asOfDate: string) {
    return this.financialReportsService.getBalanceSheet(asOfDate);
  }

  /**
   * Get Cash Flow Statement
   * GET /api/v1/financial-reports/cash-flow
   * Permissions: CFO, Owner, Finance Staff
   */
  @Get('cash-flow')
  @Roles('CFO', 'OWNER', 'FINANCE')
  async getCashFlow(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financialReportsService.getCashFlow(startDate, endDate);
  }

  /**
   * Get AR Aging Report
   * GET /api/v1/financial-reports/ar-aging
   * Permissions: CFO, Owner, Finance Staff
   */
  @Get('ar-aging')
  @Roles('CFO', 'OWNER', 'FINANCE', 'CMO')
  async getARAging(@Query('asOfDate') asOfDate?: string) {
    return this.financialReportsService.getARAging(asOfDate);
  }

  /**
   * Get Expense Summary
   * GET /api/v1/financial-reports/expense-summary
   * Permissions: CFO, Owner, Finance Staff
   */
  @Get('expense-summary')
  @Roles('CFO', 'OWNER', 'FINANCE')
  async getExpenseSummary(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.financialReportsService.getExpenseSummary(startDate, endDate);
  }
}

