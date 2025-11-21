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

      // Position allowance (TUNJANGAN JABATAN) - based on position
      // Example: HEADSTORE = 1,500,000, ASSISTANT = 700,000, TEKNISI-1 = 700,000
      let positionAllowance = new Decimal(0);
      if (employee.position) {
        const positionLower = employee.position.toLowerCase();
        if (positionLower.includes('headstore') || positionLower.includes('head store')) {
          positionAllowance = new Decimal(1500000);
        } else if (positionLower.includes('assistant')) {
          positionAllowance = new Decimal(700000);
        } else if (positionLower.includes('teknisi') || positionLower.includes('technician')) {
          positionAllowance = new Decimal(700000);
        } else {
          // Default: 10% of basic salary for other positions
          positionAllowance = basicSalary.times(0.1);
        }
      }
      if (positionAllowance.greaterThan(0)) {
        components.push({
          type: 'earning',
          name: 'Tunjangan Jabatan',
          amount: positionAllowance,
          formula: employee.position ? `Position: ${employee.position}` : '10% of basic salary',
        });
      }

      // Overtime pay (LEMBUR) - JAM, NOMINAL
      let overtimePay = new Decimal(0);
      const overtimeHours = new Decimal(attendanceSummary.totalOvertimeHours || 0);
      if (employee.hourlyRate && attendanceSummary.totalOvertimeHours > 0) {
        const hourlyRate = employee.hourlyRate;
        // 1.5x for weekday, 2x for weekend (simplified - using 1.5x)
        overtimePay = hourlyRate.times(overtimeHours).times(1.5);
        components.push({
          type: 'earning',
          name: 'Lembur',
          amount: overtimePay,
          formula: `${attendanceSummary.totalOvertimeHours} jam × ${hourlyRate.toNumber()} × 1.5`,
          notes: `${attendanceSummary.totalOvertimeHours} jam`,
        });
      }

      // KPI Bonus (from KPI record)
      let kpiBonus = new Decimal(0);
      let kpiMultiplier = new Decimal(1.0);
      if (kpiRecord && kpiRecord.calculatedBonus) {
        kpiBonus = kpiRecord.calculatedBonus;
        kpiMultiplier = kpiRecord.bonusMultiplier || new Decimal(1.0);
        components.push({
          type: 'earning',
          name: 'KPI Bonus',
          amount: kpiBonus,
          formula: `KPI Score: ${kpiRecord.overallScore.toNumber()}, Multiplier: ${kpiMultiplier.toNumber()}`,
        });
      }

      // Incentive (INSENTIF) - separate from KPI bonus, based on store revenue/performance
      // This would come from store performance data or manual input
      // For now, we'll calculate based on KPI if available, otherwise 0
      let incentiveAmount = new Decimal(0);
      let incentiveValue = new Decimal(0);
      let incentiveTotal = new Decimal(0);
      if (kpiRecord && kpiRecord.salesTargetAchievement) {
        // Example: 1% of sales target achievement
        incentiveValue = new Decimal(0.01);
        incentiveAmount = kpiRecord.salesTargetAchievement.times(incentiveValue);
        incentiveTotal = incentiveAmount;
        if (incentiveTotal.greaterThan(0)) {
          components.push({
            type: 'earning',
            name: 'Insentif',
            amount: incentiveTotal,
            formula: `Sales Achievement: ${kpiRecord.salesTargetAchievement.toNumber()} × ${incentiveValue.toNumber()}`,
            notes: `Amount: ${incentiveAmount.toNumber()}, Value: ${incentiveValue.toNumber()}, Total: ${incentiveTotal.toNumber()}`,
          });
        }
      }

      // Holiday Incentive (INSENTIF LIBUR) - HARI, NOMINAL
      // Calculate based on holidays worked
      const holidayIncentiveRate = new Decimal(0); // Would be configured
      const holidayIncentiveDays = 0; // Would come from attendance data
      const holidayIncentiveAmount = holidayIncentiveRate.times(holidayIncentiveDays);
      if (holidayIncentiveAmount.greaterThan(0)) {
        components.push({
          type: 'earning',
          name: 'Insentif Libur',
          amount: holidayIncentiveAmount,
          formula: `${holidayIncentiveDays} hari × ${holidayIncentiveRate.toNumber()}`,
          notes: `${holidayIncentiveDays} hari`,
        });
      }

      // DEDUCTIONS
      // Late/No Checklog (TERLAMBAT/TIDAK CHECKLOG) - HARI, NOMINAL
      // Based on CSV: per day, not per minute
      const latePenaltyPerDay = new Decimal(0); // Would be configured (e.g., Rp 50,000 per day)
      const lateDays = attendanceSummary.lateCount; // Days with late/no checklog
      const latePenalty = latePenaltyPerDay.times(lateDays);
      if (latePenalty.greaterThan(0)) {
        components.push({
          type: 'deduction',
          name: 'Terlambat/Tidak Checklog',
          amount: latePenalty,
          formula: `${lateDays} hari × ${latePenaltyPerDay.toNumber()}`,
          notes: `${lateDays} hari`,
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

      // Early leave penalty (PULANG CEPAT) - HARI, NOMINAL
      const earlyLeavePenaltyPerDay = new Decimal(0); // Would be configured (e.g., Rp 25,000 per day)
      const earlyLeaveDays = attendanceSummary.earlyLeaveCount;
      const earlyLeavePenalty = earlyLeavePenaltyPerDay.times(earlyLeaveDays);
      if (earlyLeavePenalty.greaterThan(0)) {
        components.push({
          type: 'deduction',
          name: 'Pulang Cepat',
          amount: earlyLeavePenalty,
          formula: `${earlyLeaveDays} hari × ${earlyLeavePenaltyPerDay.toNumber()}`,
          notes: `${earlyLeaveDays} hari`,
        });
      }

      // Conflict Holiday/No Info (BENTROK LIBUR/TANPA KETERANGAN) - HARI, NOMINAL
      // This would come from attendance data where status is conflict or no info
      const conflictHolidayPenaltyPerDay = new Decimal(0); // Would be configured
      const conflictHolidayDays = 0; // Would come from attendance data
      const conflictHolidayPenalty = conflictHolidayPenaltyPerDay.times(conflictHolidayDays);
      if (conflictHolidayPenalty.greaterThan(0)) {
        components.push({
          type: 'deduction',
          name: 'Bentrok Libur/Tanpa Keterangan',
          amount: conflictHolidayPenalty,
          formula: `${conflictHolidayDays} hari × ${conflictHolidayPenaltyPerDay.toNumber()}`,
          notes: `${conflictHolidayDays} hari`,
        });
      }

      // Extra Leave (LEBIH LIBUR) - HARI, NOMINAL
      // This would come from leave data where employee took more leave than allowed
      const extraLeavePenaltyPerDay = new Decimal(0); // Would be configured
      const extraLeaveDays = 0; // Would come from leave balance calculation
      const extraLeavePenalty = extraLeavePenaltyPerDay.times(extraLeaveDays);
      if (extraLeavePenalty.greaterThan(0)) {
        components.push({
          type: 'deduction',
          name: 'Lebih Libur',
          amount: extraLeavePenalty,
          formula: `${extraLeaveDays} hari × ${extraLeavePenaltyPerDay.toNumber()}`,
          notes: `${extraLeaveDays} hari`,
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

      // Previous Month Adjustment (PENYESUAIAN BULAN LALU) - DASAR, AMOUNT
      // This would come from previous month's payroll adjustment
      const previousMonthAdjustmentBase = new Decimal(0); // DASAR
      const previousMonthAdjustmentAmount = new Decimal(0); // AMOUNT
      if (!previousMonthAdjustmentAmount.equals(0)) {
        components.push({
          type: previousMonthAdjustmentAmount.greaterThan(0) ? 'earning' : 'deduction',
          name: 'Penyesuaian Bulan Lalu',
          amount: previousMonthAdjustmentAmount.abs(),
          formula: `Dasar: ${previousMonthAdjustmentBase.toNumber()}, Amount: ${previousMonthAdjustmentAmount.toNumber()}`,
          notes: `Dasar: ${previousMonthAdjustmentBase.toNumber()}`,
        });
      }

      // Negligence (KELALAIAN) - additional deduction for negligence
      const negligenceDeduction = new Decimal(0); // Would be configured or from incident reports
      if (negligenceDeduction.greaterThan(0)) {
        components.push({
          type: 'deduction',
          name: 'Kelalaian',
          amount: negligenceDeduction,
        });
      }

      // Withheld Salary (GAJI DITAHAN) - salary withheld for various reasons
      const withheldSalary = new Decimal(0); // Would be configured or from HR decisions
      if (withheldSalary.greaterThan(0)) {
        components.push({
          type: 'deduction',
          name: 'Gaji Ditahan',
          amount: withheldSalary,
        });
      }

      // Recalculate totals after adjustments
      const finalTotalEarnings = components
        .filter((c) => c.type === 'earning')
        .reduce((sum, c) => sum.plus(c.amount), new Decimal(0));

      const finalTotalDeductions = components
        .filter((c) => c.type === 'deduction')
        .reduce((sum, c) => sum.plus(c.amount), new Decimal(0));

      // NETT THP (Net Take Home Pay) = Final Earnings - Final Deductions
      const nettSalary = finalTotalEarnings.minus(finalTotalDeductions);

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
          totalEarnings: finalTotalEarnings,
          totalDeductions: finalTotalDeductions,
          nettSalary,
          attendanceDays: attendanceSummary.presentDays,
          lateCount: attendanceSummary.lateCount,
          lateMinutes: attendanceSummary.totalLateMinutes,
          earlyLeaveCount: attendanceSummary.earlyLeaveCount,
          absenceCount: attendanceSummary.absenceCount,
          overtimeHours: overtimeHours,
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
          totalEarnings: finalTotalEarnings,
          totalDeductions: finalTotalDeductions,
          nettSalary,
          attendanceDays: attendanceSummary.presentDays,
          lateCount: attendanceSummary.lateCount,
          lateMinutes: attendanceSummary.totalLateMinutes,
          earlyLeaveCount: attendanceSummary.earlyLeaveCount,
          absenceCount: attendanceSummary.absenceCount,
          overtimeHours: overtimeHours,
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
      const updated = await this.prisma.payroll.update({
        where: { id: payrollId },
        data: {
          approvedBy: userId,
          updatedAt: new Date(),
        },
        include: {
          employee: {
            include: { user: true, branch: true, department: true },
          },
          components: true,
        },
      });
      return {
        message: 'Payroll approved by CHR. Waiting for CFO approval.',
        data: {
          ...updated,
          totalEarnings: updated.totalEarnings.toNumber(),
          totalDeductions: updated.totalDeductions.toNumber(),
          nettSalary: updated.nettSalary.toNumber(),
        },
      };
    }

    // Second approval by CFO
    if (isCFO && payroll.approvedBy && !payroll.approvedBy2) {
      const updated = await this.prisma.payroll.update({
        where: { id: payrollId },
        data: {
          approvedBy2: userId,
          status: 'approved',
          approvedAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          employee: {
            include: { user: true, branch: true, department: true },
          },
          components: true,
        },
      });
      return {
        message: 'Payroll fully approved and ready for payment processing.',
        data: {
          ...updated,
          totalEarnings: updated.totalEarnings.toNumber(),
          totalDeductions: updated.totalDeductions.toNumber(),
          nettSalary: updated.nettSalary.toNumber(),
        },
      };
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
    // DR: Salary Expense (51100)
    // CR: Cash/Bank (10101 or 10201 based on branch)
    
    // Get GL accounts by code
    const salaryExpenseAccount = await this.prisma.chartOfAccount.findUnique({
      where: { code: '51100' }, // Salaries
    });

    if (!salaryExpenseAccount || !salaryExpenseAccount.isActive) {
      throw new NotFoundException('Salary Expense account (51100) not found or inactive. Please seed Chart of Accounts.');
    }

    // Get cash/bank account - prefer bank account, fallback to cash
    let cashBankAccount = await this.prisma.chartOfAccount.findFirst({
      where: {
        code: { startsWith: '1020' }, // Bank accounts (10201, 10202, etc)
        isHeader: false,
        isActive: true,
      },
    });

    // If no bank account found, use cash account
    if (!cashBankAccount) {
      cashBankAccount = await this.prisma.chartOfAccount.findFirst({
        where: {
          code: { startsWith: '1010' }, // Cash accounts (10101, 10102, etc)
          isHeader: false,
          isActive: true,
        },
      });
    }

    if (!cashBankAccount || !cashBankAccount.isActive) {
      throw new NotFoundException('Cash/Bank account not found or inactive. Please seed Chart of Accounts.');
    }

    const earnings = payroll.components.filter((c) => c.type === 'earning');
    const totalEarnings = earnings.reduce((sum, c) => sum.plus(c.amount), new Decimal(0));

    const journalLines = [
      {
        account_id: salaryExpenseAccount.id,
        debit_amount: totalEarnings.toNumber(),
        credit_amount: 0,
        line_description: `Payroll ${payroll.payrollNumber}`,
        branch_id: payroll.employee.branchId || undefined,
        department_id: payroll.employee.departmentId || undefined,
      },
      {
        account_id: cashBankAccount.id,
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
    await this.prisma.payroll.update({
      where: { id: payrollId },
      data: {
        status: 'paid',
        processedBy: userId,
        processedAt: new Date(),
        journalEntryId: journalEntry.id,
        updatedAt: new Date(),
      },
    });

    // Generate payslip (placeholder - would generate PDF)
    const payslipUrl = await this.generatePayslip(payrollId);
    const finalPayroll = await this.prisma.payroll.update({
      where: { id: payrollId },
      data: { payslipUrl },
      include: {
        employee: {
          include: { user: true, branch: true, department: true },
        },
        components: true,
      },
    });

    return {
      message: 'Payroll payment processed successfully',
      data: {
        ...finalPayroll,
        totalEarnings: finalPayroll.totalEarnings.toNumber(),
        totalDeductions: finalPayroll.totalDeductions.toNumber(),
        nettSalary: finalPayroll.nettSalary.toNumber(),
      },
    };
  }

  /**
   * Cancel payroll (only draft can be cancelled)
   */
  async cancelPayroll(payrollId: string, _userId: string, userRoles: string[], reason?: string) {
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

    // Only draft payroll can be cancelled
    if (payroll.status !== 'draft') {
      throw new BadRequestException('Only draft payroll can be cancelled');
    }

    // Only CHR or CFO can cancel
    if (!userRoles.includes('CHR') && !userRoles.includes('CFO')) {
      throw new ForbiddenException('Only CHR or CFO can cancel payroll');
    }

    const updated = await this.prisma.payroll.update({
      where: { id: payrollId },
      data: {
        status: 'cancelled',
        notes: reason ? `Cancelled: ${reason}` : 'Cancelled',
        updatedAt: new Date(),
      },
      include: {
        employee: {
          include: { user: true, branch: true, department: true },
        },
        components: true,
      },
    });

    return {
      message: 'Payroll cancelled successfully',
      data: {
        ...updated,
        totalEarnings: updated.totalEarnings.toNumber(),
        totalDeductions: updated.totalDeductions.toNumber(),
        nettSalary: updated.nettSalary.toNumber(),
      },
    };
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

    const [data, total] = await Promise.all([
      this.prisma.payroll.findMany({
        where,
        include: {
          employee: {
            include: { user: true },
          },
          components: true,
        },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      }),
      this.prisma.payroll.count({ where }),
    ]);

    return {
      data: data.map((payroll) => ({
        ...payroll,
        totalEarnings: payroll.totalEarnings.toNumber(),
        totalDeductions: payroll.totalDeductions.toNumber(),
        nettSalary: payroll.nettSalary.toNumber(),
      })),
      total,
    };
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

    // Transform Decimal to number for JSON serialization
    return {
      ...payroll,
      totalEarnings: payroll.totalEarnings.toNumber(),
      totalDeductions: payroll.totalDeductions.toNumber(),
      nettSalary: payroll.nettSalary.toNumber(),
    };
  }
}

