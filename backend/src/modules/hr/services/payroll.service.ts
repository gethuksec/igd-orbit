import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { CalculatePayrollDto } from '../dto/calculate-payroll.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { AttendanceService } from './attendance.service';
import { JournalEntriesService } from '../../finance/services/journal-entries.service';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private attendanceService: AttendanceService,
    private journalEntriesService: JournalEntriesService,
  ) {}

  /**
   * Generate payroll number
   */
  private async generatePayrollNumber(month: number, year: number): Promise<string> {
    const monthStr = month.toString().padStart(2, '0');
    const yearStr = year.toString();
    const latestPayroll = await this.prisma.payroll.findFirst({
      where: {
        payrollNumber: { startsWith: `PAY-${yearStr}${monthStr}` },
      },
      orderBy: { payrollNumber: 'desc' },
    });

    let sequence = 1;
    if (latestPayroll?.payrollNumber) {
      const lastSequence = parseInt(latestPayroll.payrollNumber.slice(-6), 10);
      sequence = lastSequence + 1;
    }
    return `PAY-${yearStr}${monthStr}-${sequence.toString().padStart(6, '0')}`;
  }

  /**
   * Calculate tenure allowance (years of service)
   */
  private calculateTenureAllowance(hireDate: Date | null, basicSalary: Decimal): Decimal {
    if (!hireDate || !basicSalary) {
      return new Decimal(0);
    }

    const yearsOfService = Math.floor(
      (new Date().getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24 * 365),
    );

    // 2% per year, max 20%
    const percentage = Math.min(yearsOfService * 0.02, 0.2);
    return basicSalary.times(percentage);
  }

  /**
   * Calculate payroll for period
   */
  async calculatePayroll(dto: CalculatePayrollDto, userId: string) {
    // Get active employees
    const where: any = { isActive: true };
    if (dto.employee_ids && dto.employee_ids.length > 0) {
      where.id = { in: dto.employee_ids };
    }

    const employees = await this.prisma.employee.findMany({
      where,
      include: {
        user: true,
        branch: true,
        department: true,
      },
    });

    if (employees.length === 0) {
      throw new NotFoundException('No active employees found');
    }

    const payrollResults = [];

    for (const employee of employees) {
      if (!employee.basicSalary) {
        console.warn(`Employee ${employee.employeeCode} has no basic salary, skipping`);
        continue;
      }

      // Get attendance summary
      const attendanceSummary = await this.attendanceService.getMonthlySummary(
        employee.userId,
        dto.period_month,
        dto.period_year,
      );

      // Get leave records
      const yearStart = new Date(dto.period_year, dto.period_month - 1, 1);
      const yearEnd = new Date(dto.period_year, dto.period_month, 0, 23, 59, 59);
      const unpaidLeaves = await this.prisma.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
          leaveType: 'unpaid',
          status: 'approved',
          startDate: { gte: yearStart, lte: yearEnd },
        },
      });
      const unpaidLeaveDays = unpaidLeaves.reduce((sum, l) => sum + l.totalDays, 0);

      // Get KPI record for bonus calculation
      const kpiRecord = await this.prisma.kPIRecord.findUnique({
        where: {
          employeeId_periodMonth_periodYear: {
            employeeId: employee.id,
            periodMonth: dto.period_month,
            periodYear: dto.period_year,
          },
        },
      });

      // Calculate components
      const components: Array<{ type: string; name: string; amount: Decimal; formula?: string; notes?: string }> = [];

      // EARNINGS
      const basicSalary = employee.basicSalary;
      components.push({
        type: 'earning',
        name: 'Basic Salary',
        amount: basicSalary,
        formula: 'Fixed',
      });

      // Tenure allowance
      const tenureAllowance = this.calculateTenureAllowance(employee.hireDate, basicSalary);
      if (tenureAllowance.greaterThan(0)) {
        components.push({
          type: 'earning',
          name: 'Tenure Allowance',
          amount: tenureAllowance,
          formula: `${Math.floor((new Date().getTime() - (employee.hireDate?.getTime() || 0)) / (1000 * 60 * 60 * 24 * 365))} years × 2%`,
        });
      }

      // Position allowance (example: 10% of basic for certain roles)
      const positionAllowance = new Decimal(0); // Would be configured per position
      if (positionAllowance.greaterThan(0)) {
        components.push({
          type: 'earning',
          name: 'Position Allowance',
          amount: positionAllowance,
        });
      }

      // Attendance bonus
      const attendanceBonusRate = new Decimal(50000); // Per day
      const attendanceBonus = attendanceBonusRate.times(attendanceSummary.presentDays);
      if (attendanceBonus.greaterThan(0)) {
        components.push({
          type: 'earning',
          name: 'Attendance Bonus',
          amount: attendanceBonus,
          formula: `${attendanceSummary.presentDays} days × Rp 50,000`,
        });
      }

      // Overtime pay
      let overtimePay = new Decimal(0);
      if (employee.hourlyRate && attendanceSummary.totalOvertimeHours > 0) {
        const hourlyRate = employee.hourlyRate;
        const overtimeHours = new Decimal(attendanceSummary.totalOvertimeHours);
        // 1.5x for weekday, 2x for weekend (simplified - using 1.5x)
        overtimePay = hourlyRate.times(overtimeHours).times(1.5);
        components.push({
          type: 'earning',
          name: 'Overtime Pay',
          amount: overtimePay,
          formula: `${attendanceSummary.totalOvertimeHours} hours × ${hourlyRate.toNumber()} × 1.5`,
        });
      }

      // KPI Bonus
      let kpiBonus = new Decimal(0);
      if (kpiRecord && kpiRecord.calculatedBonus) {
        kpiBonus = kpiRecord.calculatedBonus;
        components.push({
          type: 'earning',
          name: 'KPI Bonus',
          amount: kpiBonus,
          formula: `KPI Score: ${kpiRecord.overallScore.toNumber()}`,
        });
      }

      // DEDUCTIONS
      // Late penalty
      const latePenaltyPerMinute = new Decimal(1000);
      const latePenalty = latePenaltyPerMinute.times(attendanceSummary.totalLateMinutes);
      if (latePenalty.greaterThan(0)) {
        components.push({
          type: 'deduction',
          name: 'Late Penalty',
          amount: latePenalty,
          formula: `${attendanceSummary.totalLateMinutes} minutes × Rp 1,000`,
        });
      }

      // Absence deduction
      const dailyRate = basicSalary.dividedBy(30); // Simplified
      const absenceDeduction = dailyRate.times(attendanceSummary.absenceCount);
      if (absenceDeduction.greaterThan(0)) {
        components.push({
          type: 'deduction',
          name: 'Absence Deduction',
          amount: absenceDeduction,
          formula: `${attendanceSummary.absenceCount} days × ${dailyRate.toNumber()}`,
        });
      }

      // Early leave penalty
      const earlyLeavePenalty = new Decimal(25000).times(attendanceSummary.earlyLeaveCount);
      if (earlyLeavePenalty.greaterThan(0)) {
        components.push({
          type: 'deduction',
          name: 'Early Leave Penalty',
          amount: earlyLeavePenalty,
          formula: `${attendanceSummary.earlyLeaveCount} × Rp 25,000`,
        });
      }

      // Unpaid leave deduction
      const unpaidLeaveDeduction = dailyRate.times(unpaidLeaveDays);
      if (unpaidLeaveDeduction.greaterThan(0)) {
        components.push({
          type: 'deduction',
          name: 'Unpaid Leave Deduction',
          amount: unpaidLeaveDeduction,
          formula: `${unpaidLeaveDays} days × ${dailyRate.toNumber()}`,
        });
      }

      // Calculate totals
      const totalEarnings = components
        .filter((c) => c.type === 'earning')
        .reduce((sum, c) => sum.plus(c.amount), new Decimal(0));

      const totalDeductions = components
        .filter((c) => c.type === 'deduction')
        .reduce((sum, c) => sum.plus(c.amount), new Decimal(0));

      const nettSalary = totalEarnings.minus(totalDeductions);

      // Check if payroll already exists
      const existingPayroll = await this.prisma.payroll.findUnique({
        where: {
          employeeId_periodMonth_periodYear: {
            employeeId: employee.id,
            periodMonth: dto.period_month,
            periodYear: dto.period_year,
          },
        },
      });

      if (existingPayroll && existingPayroll.status !== 'draft') {
        console.warn(`Payroll already exists and is not draft for ${employee.employeeCode}, skipping`);
        continue;
      }

      // Create or update payroll
      const payrollNumber = existingPayroll
        ? existingPayroll.payrollNumber
        : await this.generatePayrollNumber(dto.period_month, dto.period_year);

      const payroll = await this.prisma.payroll.upsert({
        where: existingPayroll
          ? { id: existingPayroll.id }
          : {
              employeeId_periodMonth_periodYear: {
                employeeId: employee.id,
                periodMonth: dto.period_month,
                periodYear: dto.period_year,
              },
            },
        update: {
          totalEarnings,
          totalDeductions,
          nettSalary,
          attendanceDays: attendanceSummary.presentDays,
          lateCount: attendanceSummary.lateCount,
          lateMinutes: attendanceSummary.totalLateMinutes,
          earlyLeaveCount: attendanceSummary.earlyLeaveCount,
          absenceCount: attendanceSummary.absenceCount,
          overtimeHours: new Decimal(attendanceSummary.totalOvertimeHours),
          unpaidLeaveDays,
          calculatedBy: userId,
          calculatedAt: new Date(),
          updatedAt: new Date(),
        },
        create: {
          employeeId: employee.id,
          periodMonth: dto.period_month,
          periodYear: dto.period_year,
          payrollNumber,
          totalEarnings,
          totalDeductions,
          nettSalary,
          attendanceDays: attendanceSummary.presentDays,
          lateCount: attendanceSummary.lateCount,
          lateMinutes: attendanceSummary.totalLateMinutes,
          earlyLeaveCount: attendanceSummary.earlyLeaveCount,
          absenceCount: attendanceSummary.absenceCount,
          overtimeHours: new Decimal(attendanceSummary.totalOvertimeHours),
          unpaidLeaveDays,
          calculatedBy: userId,
          calculatedAt: new Date(),
        },
      });

      // Delete old components and create new ones
      await this.prisma.payrollComponent.deleteMany({
        where: { payrollId: payroll.id },
      });

      // Create components
      for (const component of components) {
        await this.prisma.payrollComponent.create({
          data: {
            payrollId: payroll.id,
            type: component.type,
            name: component.name,
            amount: component.amount,
            formula: component.formula,
            notes: component.notes,
          },
        });
      }

      payrollResults.push({
        payrollId: payroll.id,
        employeeCode: employee.employeeCode,
        employeeName: employee.user.fullName,
        payrollNumber: payroll.payrollNumber,
        nettSalary: nettSalary.toNumber(),
      });
    }

    return {
      periodMonth: dto.period_month,
      periodYear: dto.period_year,
      totalEmployees: employees.length,
      calculatedPayrolls: payrollResults.length,
      payrolls: payrollResults,
    };
  }

  /**
   * Approve payroll (dual approval: CHR + CFO)
   */
  async approvePayroll(payrollId: string, userId: string, userRoles: string[]) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id: payrollId },
      include: { employee: { include: { user: true } } },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }

    if (payroll.status !== 'draft') {
      throw new BadRequestException('Payroll is not in draft status');
    }

    // Check if first approval (CHR) or second approval (CFO)
    const isCHR = userRoles.includes('CHR');
    const isCFO = userRoles.includes('CFO');

    if (!isCHR && !isCFO) {
      throw new ForbiddenException('Only CHR or CFO can approve payroll');
    }

    // First approval by CHR
    if (isCHR && !payroll.approvedBy) {
      await this.prisma.payroll.update({
        where: { id: payrollId },
        data: {
          approvedBy: userId,
          updatedAt: new Date(),
        },
      });
      return { message: 'Payroll approved by CHR. Waiting for CFO approval.' };
    }

    // Second approval by CFO
    if (isCFO && payroll.approvedBy && !payroll.approvedBy2) {
      await this.prisma.payroll.update({
        where: { id: payrollId },
        data: {
          approvedBy2: userId,
          status: 'approved',
          approvedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      return { message: 'Payroll fully approved and ready for payment processing.' };
    }

    throw new BadRequestException('Payroll approval already completed');
  }

  /**
   * Process payment
   */
  async processPayment(payrollId: string, userId: string, userRoles: string[]) {
    if (!userRoles.includes('CFO')) {
      throw new ForbiddenException('Only CFO can process payroll payment');
    }

    const payroll = await this.prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        employee: {
          include: {
            user: true,
          },
        },
        components: true,
      },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }

    if (payroll.status !== 'approved') {
      throw new BadRequestException('Payroll must be approved before processing payment');
    }

    // Create journal entry
    // DR: Salary Expense, Overtime Expense, Bonus Expense
    // CR: Cash/Bank
    // This is simplified - would need proper GL account mapping
    const salaryExpenseAccountId = 'some-salary-expense-account-id'; // TODO: Get from COA
    const cashBankAccountId = 'some-cash-bank-account-id'; // TODO: Get from employee branch or default

    const earnings = payroll.components.filter((c) => c.type === 'earning');
    const totalEarnings = earnings.reduce((sum, c) => sum.plus(c.amount), new Decimal(0));

    const journalLines = [
      {
        account_id: salaryExpenseAccountId,
        debit_amount: totalEarnings.toNumber(),
        credit_amount: 0,
        line_description: `Payroll ${payroll.payrollNumber}`,
        branch_id: payroll.employee.branchId || undefined,
        department_id: payroll.employee.departmentId || undefined,
      },
      {
        account_id: cashBankAccountId,
        debit_amount: 0,
        credit_amount: totalEarnings.toNumber(),
        line_description: `Payment for ${payroll.employee.user?.fullName || 'Employee'}`,
        branch_id: payroll.employee.branchId || undefined,
        department_id: payroll.employee.departmentId || undefined,
      },
    ];

    const journalEntry = await this.journalEntriesService.create(
      {
        entry_date: new Date().toISOString(),
        entry_type: 'auto',
        description: `Payroll payment for ${payroll.payrollNumber}`,
        reference_type: 'payroll',
        reference_id: payroll.id,
        lines: journalLines,
      },
      userId,
    );

    // Post journal entry
    await this.journalEntriesService.post(journalEntry.id, userId);

    // Update payroll status
    const updated = await this.prisma.payroll.update({
      where: { id: payrollId },
      data: {
        status: 'paid',
        processedBy: userId,
        processedAt: new Date(),
        journalEntryId: journalEntry.id,
        updatedAt: new Date(),
      },
      include: {
        employee: { include: { user: true } },
        components: true,
      },
    });

    // Generate payslip (placeholder - would generate PDF)
    const payslipUrl = await this.generatePayslip(payrollId);
    await this.prisma.payroll.update({
      where: { id: payrollId },
      data: { payslipUrl },
    });

    return updated;
  }

  /**
   * Generate payslip PDF
   */
  async generatePayslip(payrollId: string): Promise<string> {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        employee: {
          include: { user: true, branch: true, department: true },
        },
        components: true,
      },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }

    // TODO: Generate actual PDF using a library like pdfkit or puppeteer
    // For now, return a placeholder URL
    const payslipUrl = `/payslips/${payroll.payrollNumber}.pdf`;

    // In production, this would:
    // 1. Generate PDF with company header, employee info, period, earnings, deductions, net salary
    // 2. Save to storage (S3/MinIO)
    // 3. Return the URL

    return payslipUrl;
  }

  /**
   * Get payroll list
   */
  async findAll(employeeId?: string, periodMonth?: number, periodYear?: number, status?: string) {
    const where: any = {};

    if (employeeId) {
      where.employeeId = employeeId;
    }

    if (periodMonth) {
      where.periodMonth = periodMonth;
    }

    if (periodYear) {
      where.periodYear = periodYear;
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.payroll.findMany({
      where,
      include: {
        employee: {
          include: { user: true },
        },
        components: true,
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
  }

  /**
   * Get payroll detail
   */
  async findById(id: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        employee: {
          include: { user: true, branch: true, department: true },
        },
        components: true,
        journalEntry: true,
      },
    });

    if (!payroll) {
      throw new NotFoundException('Payroll not found');
    }

    return payroll;
  }
}

