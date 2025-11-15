import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ChartOfAccountsService } from './services/chart-of-accounts.service';

@Controller('chart-of-accounts')
export class ChartOfAccountsController {
  constructor(
    private readonly chartOfAccountsService: ChartOfAccountsService,
  ) {}

  /**
   * Get all active accounts
   * GET /api/v1/chart-of-accounts
   * Permissions: All authenticated users
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    return this.chartOfAccountsService.findAll();
  }

  /**
   * Get account by ID
   * GET /api/v1/chart-of-accounts/:id
   * Permissions: All authenticated users
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findById(@Param('id') id: string) {
    return this.chartOfAccountsService.findById(id);
  }

  /**
   * Get accounts by type
   * GET /api/v1/chart-of-accounts/type/:type
   * Permissions: All authenticated users
   */
  @Get('type/:type')
  @UseGuards(JwtAuthGuard)
  async findByType(@Param('type') type: string) {
    return this.chartOfAccountsService.findByType(type);
  }

  /**
   * Seed Chart of Accounts
   * POST /api/v1/chart-of-accounts/seed
   * Permissions: CFO, Finance Staff
   */
  @Post('seed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CFO', 'FINANCE')
  async seed() {
    return this.chartOfAccountsService.seedChartOfAccounts();
  }
}

