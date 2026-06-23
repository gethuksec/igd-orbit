import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { SalesTransactionsService } from './sales-transactions.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import {
  CreateSalesTransactionDto,
  VoidTransactionDto,
  HoldTransactionDto,
} from './dto';

// Helper to check branch access similar to DashboardController
const ensureBranchAccess = (req: ExpressRequest & { user: any }, branchId?: string) => {
  const userBranchIds = (req.user as any)?.branchIds;
  const userRoles: string[] = (req.user as any)?.roles || [];

  // SUPERADMIN, OWNER, and CFO have global access to all branches
  const isGlobalRole =
    userRoles.includes('SUPERADMIN') ||
    userRoles.includes('OWNER') ||
    userRoles.includes('CFO');

  // Global roles can access any / all branches
  if (isGlobalRole) {
    return branchId;
  }

  // null/undefined branchIds means all branches (e.g. no branch assignment)
  if (userBranchIds === null || userBranchIds === undefined) {
    return branchId;
  }

  if (!Array.isArray(userBranchIds) || userBranchIds.length === 0) {
    throw new ForbiddenException('You do not have any branch access.');
  }

  // If specific branch requested, ensure it is allowed
  if (branchId) {
    if (!userBranchIds.includes(branchId)) {
      throw new ForbiddenException('You do not have access to this branch.');
    }
    return branchId;
  }

  // No branch specified → default to first allowed branch
  return userBranchIds[0];
};

/**
 * Sales Transactions Controller
 * Handles POS transaction endpoints
 */
@Controller('sales/transactions')
@UseGuards(JwtAuthGuard)
export class SalesTransactionsController {
  constructor(private readonly salesTransactionsService: SalesTransactionsService) {}

  /**
   * Create POS transaction
   * POST /api/v1/sales/transactions
   * Permissions: CS, CR, HS, SPV
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CS', 'CR', 'HS', 'SPV')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createDto: CreateSalesTransactionDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    // Validate branch access: use branch from DTO but enforce against user branchIds
    const branchId = ensureBranchAccess(req, createDto.branchId) as string;
    if (!branchId) {
      throw new ForbiddenException('Branch ID is required for creating transactions.');
    }

    return this.salesTransactionsService.create(createDto, req.user.id, branchId);
  }

  /**
   * List transactions
   * GET /api/v1/sales/transactions
   * Permissions: All authenticated users
   */
  @Get()
  async findAll(
    @Query() query: any,
    @Request() req: ExpressRequest & { user: any },
  ) {
    // Enforce branch access for non-global roles
    const effectiveBranchId = ensureBranchAccess(req, query.branchId);
    const finalQuery = {
      ...query,
      branchId: effectiveBranchId,
    };
    return this.salesTransactionsService.findAll(finalQuery);
  }

  /**
   * Get transaction detail
   * GET /api/v1/sales/transactions/:id
   * Permissions: All authenticated users
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.salesTransactionsService.findById(id);
  }

  /**
   * Update transaction (if status = pending)
   * PUT /api/v1/sales/transactions/:id
   * Permissions: CS, CR, HS, SPV
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CS', 'CR', 'HS', 'SPV')
  async update(
    @Param('id') id: string,
    @Body() updateDto: any,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.salesTransactionsService.update(id, updateDto, req.user.id);
  }

  /**
   * Void transaction
   * POST /api/v1/sales/transactions/:id/void
   * Permissions: HS (same day), SPV (past)
   */
  @Post(':id/void')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CMO')
  @HttpCode(HttpStatus.OK)
  async void(
    @Param('id') id: string,
    @Body() voidDto: VoidTransactionDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    await this.salesTransactionsService.void(id, voidDto, req.user.id);
    return { message: 'Transaction voided successfully' };
  }

  /**
   * Hold current transaction
   * POST /api/v1/sales/transactions/:id/hold
   * Permissions: CS, CR, HS, SPV
   */
  @Post(':id/hold')
  @UseGuards(RolesGuard)
  @Roles('CS', 'CR', 'HS', 'SPV')
  @HttpCode(HttpStatus.OK)
  async hold(
    @Param('id') id: string,
    @Body() holdDto: HoldTransactionDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    const branchId = (req.user as any).branchId;
    if (!branchId) {
      throw new Error('Branch ID is required');
    }

    const holdId = await this.salesTransactionsService.hold(id, holdDto, req.user.id, branchId);
    return { holdId, message: 'Transaction held successfully' };
  }

  /**
   * Resume held transaction
   * POST /api/v1/sales/transactions/:id/resume
   * Permissions: CS, CR, HS, SPV
   */
  @Post(':id/resume')
  @UseGuards(RolesGuard)
  @Roles('CS', 'CR', 'HS', 'SPV')
  @HttpCode(HttpStatus.OK)
  async resume(@Param('id') id: string) {
    return this.salesTransactionsService.resume(id);
  }

  /**
   * List held transactions
   * GET /api/v1/sales/held-transactions
   * Permissions: CS, CR, HS, SPV
   */
  @Get('held/list')
  @UseGuards(RolesGuard)
  @Roles('CS', 'CR', 'HS', 'SPV')
  async listHeldTransactions(
    @Query('branchId') branchId: string | undefined,
    @Request() req: ExpressRequest & { user: any },
  ) {
    const effectiveBranchId = ensureBranchAccess(req, branchId);
    return this.salesTransactionsService.listHeldTransactions(effectiveBranchId);
  }

  /**
   * Generate/print receipt
   * POST /api/v1/sales/transactions/:id/receipt
   * Permissions: All authenticated users
   */
  @Post(':id/receipt')
  @HttpCode(HttpStatus.OK)
  async generateReceipt(@Param('id') id: string) {
    const receiptUrl = await this.salesTransactionsService.generateReceipt(id);
    return { receiptUrl, message: 'Receipt generated successfully' };
  }
}

