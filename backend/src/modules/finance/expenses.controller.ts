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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ExpensesService } from './services/expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ApproveExpenseDto } from './dto/approve-expense.dto';
import { RejectExpenseDto } from './dto/reject-expense.dto';
import { PayExpenseDto } from './dto/pay-expense.dto';

@Controller('expenses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  /**
   * Create expense
   * POST /api/v1/expenses
   * Permissions: All staff
   */
  @Post()
  @Roles('CFO', 'SPV', 'HS', 'CS', 'TC', 'SODO', 'ASA', 'AR', 'SMO', 'AS', 'CR')
  async create(@Body() dto: CreateExpenseDto, @Request() req: any) {
    return this.expensesService.createExpense(dto, req.user.id);
  }

  /**
   * List expenses
   * GET /api/v1/expenses
   * Permissions: All authenticated users
   */
  @Get()
  @Roles('CFO', 'SPV', 'HS', 'CS', 'TC', 'SODO', 'ASA', 'AR', 'SMO', 'AS', 'CR', 'OWNER')
  async findAll(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
    @Query('departmentId') departmentId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.expensesService.findAll({
      startDate,
      endDate,
      status,
      branchId,
      departmentId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * Get expense detail
   * GET /api/v1/expenses/:id
   * Permissions: All authenticated users
   */
  @Get(':id')
  @Roles('CFO', 'SPV', 'HS', 'CS', 'TC', 'SODO', 'ASA', 'AR', 'SMO', 'AS', 'CR', 'OWNER')
  async findById(@Param('id') id: string) {
    return this.expensesService.findById(id);
  }

  /**
   * Update expense (only if pending)
   * PUT /api/v1/expenses/:id
   * Permissions: All staff
   */
  @Put(':id')
  @Roles('CFO', 'SPV', 'HS', 'CS', 'TC', 'SODO', 'ASA', 'AR', 'SMO', 'AS', 'CR')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateExpenseDto>,
    @Request() req: any,
  ) {
    return this.expensesService.update(id, dto, req.user.id);
  }

  /**
   * Approve expense
   * POST /api/v1/expenses/:id/approve
   * Permissions: HS, SPV, CFO (based on amount)
   */
  @Post(':id/approve')
  @Roles('HS', 'SPV', 'CFO')
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveExpenseDto,
    @Request() req: any,
  ) {
    return this.expensesService.approveExpense(
      id,
      dto,
      req.user.id,
      req.user.roles || [],
    );
  }

  /**
   * Reject expense
   * POST /api/v1/expenses/:id/reject
   * Permissions: HS, SPV, CFO (based on amount)
   */
  @Post(':id/reject')
  @Roles('HS', 'SPV', 'CFO')
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectExpenseDto,
    @Request() req: any,
  ) {
    return this.expensesService.rejectExpense(
      id,
      dto,
      req.user.id,
      req.user.roles || [],
    );
  }

  /**
   * Pay expense
   * POST /api/v1/expenses/:id/pay
   * Permissions: CFO, Finance Staff
   */
  @Post(':id/pay')
  @Roles('CFO', 'FINANCE')
  async pay(
    @Param('id') id: string,
    @Body() dto: PayExpenseDto,
    @Request() req: any,
  ) {
    return this.expensesService.payExpense(id, dto, req.user.id);
  }
}

