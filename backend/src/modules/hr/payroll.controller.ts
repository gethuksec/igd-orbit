import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { PayrollService } from './services/payroll.service';
import { CalculatePayrollDto } from './dto/calculate-payroll.dto';

interface ExpressRequest extends Request {
  user: {
    id: string;
    roles: string[];
  };
}

@Controller('payroll')
@UseGuards(JwtAuthGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  /**
   * Calculate payroll for period
   * POST /api/v1/payroll/calculate
   */
  @Post('calculate')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'CFO')
  async calculatePayroll(
    @Request() req: ExpressRequest,
    @Body() dto: CalculatePayrollDto,
  ) {
    return this.payrollService.calculatePayroll(dto, req.user.id);
  }

  /**
   * List payroll records
   * GET /api/v1/payroll
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('CHR', 'CFO', 'OWNER')
  async findAll(
    @Query('employeeId') employeeId?: string,
    @Query('periodMonth') periodMonth?: string,
    @Query('periodYear') periodYear?: string,
    @Query('status') status?: string,
  ) {
    return this.payrollService.findAll(
      employeeId,
      periodMonth ? parseInt(periodMonth, 10) : undefined,
      periodYear ? parseInt(periodYear, 10) : undefined,
      status,
    );
  }

  /**
   * Get payroll detail
   * GET /api/v1/payroll/:id
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.payrollService.findById(id);
  }

  /**
   * Approve payroll
   * POST /api/v1/payroll/:id/approve
   */
  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'CFO')
  async approvePayroll(@Request() req: ExpressRequest, @Param('id') id: string) {
    return this.payrollService.approvePayroll(id, req.user.id, req.user.roles);
  }

  /**
   * Process payment
   * POST /api/v1/payroll/:id/process
   */
  @Post(':id/process')
  @UseGuards(RolesGuard)
  @Roles('CFO')
  async processPayment(@Request() req: ExpressRequest, @Param('id') id: string) {
    return this.payrollService.processPayment(id, req.user.id, req.user.roles);
  }

  /**
   * Cancel payroll
   * POST /api/v1/payroll/:id/cancel
   */
  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'CFO')
  async cancelPayroll(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.payrollService.cancelPayroll(id, req.user.id, req.user.roles, body.reason);
  }

  /**
   * Generate payslip PDF
   * GET /api/v1/payroll/:id/slip
   */
  @Get(':id/slip')
  async generatePayslip(@Param('id') id: string) {
    const payslipUrl = await this.payrollService.generatePayslip(id);
    return { payslipUrl };
  }
}

