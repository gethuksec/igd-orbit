import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { PasswordService } from '../../../shared/services/password.service';
import { CalculatePayrollDto } from '../dto/calculate-payroll.dto';
import { SetPayslipPinDto } from '../dto/payslip-pin.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { AttendanceService } from './attendance.service';
import { JournalEntriesService } from '../../finance/services/journal-entries.service';
import { KPIService } from './kpi.service';

@Injectable()
export class PayrollService {
  constructor(
    private prisma: PrismaService,
    private attendanceService: AttendanceService,
    private journalEntriesService: JournalEntriesService,
    private passwordService: PasswordService,
    private kpiService: KPIService,
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
        position: { include: { grade: true } },
      },
    });

    if (employees.length === 0) {
      throw new NotFoundException('No active employees found');
    }

    // IGDERP-289: resolve the masters selected on the hitung page.
    // Inactive/unknown IDs are rejected — the checklist only offers active masters.
    const requestedIds = [...new Set((dto.components || []).map((c) => c.masterId))];
    const masters = await this.prisma.payrollComponentMaster.findMany({
      where: { id: { in: requestedIds }, deletedAt: null },
    });
    const foundIds = new Set(masters.map((m) => m.id));
    const unknownIds = requestedIds.filter((id) => !foundIds.has(id));
    if (unknownIds.length > 0) {
      throw new BadRequestException(`Komponen tidak dikenal: ${unknownIds.join(', ')}`);
    }
    const inactiveMasters = masters.filter((m) => !m.isActive);
    if (inactiveMasters.length > 0) {
      throw new BadRequestException(
        `Komponen nonaktif tidak bisa dihitung: ${inactiveMasters.map((m) => m.code).join(', ')}`,
      );
    }
    const notesById = new Map((dto.components || []).map((c) => [c.masterId, c.notes]));
    const selectedMasters = masters.map((master) => ({ master, notes: notesById.get(master.id) }));

    // Penalty rates backing the NOMINAL-* deduction rows (fallback = nilai sheet).
    const dendaRates = await this.prisma.penaltyType.findMany({
      where: {
        code: { in: ['DENDA-TERLAMBAT', 'DENDA-ALPHA', 'DENDA-LEBIH-LIBUR', 'DENDA-PULANG-CEPAT'] },
        isActive: true,
      },
    });

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
          leaveType: { code: 'TANPA-GAJI' },
          status: 'approved',
          startDate: { gte: yearStart, lte: yearEnd },
        },
      });
      const unpaidLeaveDays = unpaidLeaves.reduce((sum, l) => sum + l.totalDays, 0);

      // KPI bonus (IGDERP-266): locked NILAI x division default_amount.
      // Zero + reason when the period is not locked or the employee is
      // probation-gated (trial/probation get no KPI until lulus probation).
      const kpi = await this.kpiService.payrollKpi(employee.id, dto.period_month, dto.period_year);

      // Master-driven components (IGDERP-289): only the masters selected on
      // the hitung page resolve into rows. Amount rules follow the
      // Format_HR_ORBIT.xlsx Payroll sheet formulas (R=Q*M, V=SWITCH N,
      // W=SWITCH O, Z=Y*15000, AG=15000*AF, AI=100000*AH, AK=60000*AJ,
      // AL=40000*0.25, AP=AN*AO). Category (+/-) comes from the master.
      const components: Array<{ type: string; name: string; amount: Decimal; formula?: string; notes?: string }> = [];

      const selectedByCode = new Map(selectedMasters.map((m) => [m.master.code, m]));
      const hasMaster = (code: string) => selectedByCode.has(code);
      const pushMaster = (code: string, amount: Decimal, formula?: string) => {
        const m = selectedByCode.get(code);
        if (!m) return;
        components.push({
          type: m.master.category,
          name: m.master.name,
          amount,
          formula,
          notes: m.notes || undefined,
        });
      };

      // EARNINGS
      const basicSalary = employee.basicSalary;
      const dailyRate = basicSalary.dividedBy(30); // Q = gaji/30 (kolom Q sheet = 0, staf bulanan)
      const overtimeHours = new Decimal(attendanceSummary.totalOvertimeHours || 0);

      // GAJI-POKOK (P): prefill kontrak basicSalary
      if (hasMaster('GAJI-POKOK')) {
        pushMaster('GAJI-POKOK', basicSalary, 'Kontrak basicSalary');
      }

      // TOTAL-GAJI-HARIAN (R = Q*M)
      if (hasMaster('TOTAL-GAJI-HARIAN')) {
        pushMaster(
          'TOTAL-GAJI-HARIAN',
          dailyRate.times(attendanceSummary.presentDays),
          `Q x M (Q = gaji/30, M = ${attendanceSummary.presentDays} hadir)`,
        );
      }

      // TUNJANGAN-MASA-KERJA: 2% per tahun, maks 20%
      if (hasMaster('TUNJ-MASA-KERJA')) {
        const tenureAllowance = this.calculateTenureAllowance(employee.hireDate, basicSalary);
        if (tenureAllowance.greaterThan(0)) {
          pushMaster(
            'TUNJ-MASA-KERJA',
            tenureAllowance,
            `${Math.floor((new Date().getTime() - (employee.hireDate?.getTime() || 0)) / (1000 * 60 * 60 * 24 * 365))} tahun x 2%`,
          );
        } else {
          pushMaster('TUNJ-MASA-KERJA', new Decimal(0), 'Belum 1 tahun masa kerja');
        }
      }

      // Manual earnings: HR mengisi via penyesuaian (tidak ada input jumlah di halaman hitung)
      for (const code of ['SELISIH', 'TUNJ-JABATAN', 'KEKURANGAN-BLN-LALU']) {
        if (hasMaster(code)) {
          pushMaster(code, new Decimal(0), 'Manual — diisi HR');
        }
      }

      // TUNJANGAN-KELUARGA (V = SWITCH N): butuh data status keluarga karyawan
      if (hasMaster('TUNJ-KELUARGA')) {
        pushMaster('TUNJ-KELUARGA', new Decimal(0), 'Perlu data status keluarga karyawan (K-0..K-3)');
      }

      // TUNJANGAN-PENDIDIKAN (W = SWITCH O): butuh data pendidikan karyawan
      if (hasMaster('TUNJ-PENDIDIKAN')) {
        pushMaster('TUNJ-PENDIDIKAN', new Decimal(0), 'Perlu data pendidikan karyawan (SMA/K, S-1, S-2)');
      }

      // TRANSPORTASI (X): nominal tetap dari master
      if (hasMaster('TRANSPORTASI')) {
        const m = selectedByCode.get('TRANSPORTASI')!;
        const fixed = m.master.defaultAmount ? new Decimal(m.master.defaultAmount.toString()) : new Decimal(0);
        pushMaster('TRANSPORTASI', fixed, 'Nominal tetap master');
      }

      // NOMINAL-LEMBUR (Z = Y*15000)
      if (hasMaster('NOMINAL-LEMBUR')) {
        pushMaster(
          'NOMINAL-LEMBUR',
          overtimeHours.times(15000),
          `${attendanceSummary.totalOvertimeHours} jam x 15.000`,
        );
      }

      // TOTAL-KPI (AP = AN*AO, IGDERP-266: locked NILAI x division default)
      if (hasMaster('TOTAL-KPI')) {
        if (kpi.bonus.greaterThan(0)) {
          pushMaster('TOTAL-KPI', kpi.bonus, `NILAI: ${kpi.nilai.toNumber()}`);
        } else {
          pushMaster('TOTAL-KPI', new Decimal(0), kpi.reason || undefined);
        }
      }

      // DEDUCTIONS
      const dendaRate = (code: string, fallback: number) => {
        const row = dendaRates.find((d) => d.code === code);
        const v = row?.defaultAmount ? Number(row.defaultAmount.toString()) : NaN;
        return Number.isFinite(v) && v > 0 ? v : fallback;
      };

      // NOMINAL-TFS (AG = 15.000*AF, links DENDA-TERLAMBAT)
      if (hasMaster('NOMINAL-TFS')) {
        const rate = dendaRate('DENDA-TERLAMBAT', 15000);
        pushMaster('NOMINAL-TFS', new Decimal(attendanceSummary.lateCount).times(rate), `${attendanceSummary.lateCount} hari x ${rate.toLocaleString('id-ID')}`);
      }

      // NOMINAL-BA (AI = 100.000*AH, links DENDA-ALPHA)
      if (hasMaster('NOMINAL-BA')) {
        const rate = dendaRate('DENDA-ALPHA', 100000);
        pushMaster('NOMINAL-BA', new Decimal(attendanceSummary.absenceCount).times(rate), `${attendanceSummary.absenceCount} hari x ${rate.toLocaleString('id-ID')}`);
      }

      // NOMINAL-LEBIH-LIBUR (AK = 60.000*AJ, links DENDA-LEBIH-LIBUR)
      if (hasMaster('NOMINAL-LBL-LIBUR')) {
        const rate = dendaRate('DENDA-LEBIH-LIBUR', 60000);
        pushMaster('NOMINAL-LBL-LIBUR', new Decimal(attendanceSummary.leaveCount).times(rate), `${attendanceSummary.leaveCount} hari x ${rate.toLocaleString('id-ID')}`);
      }

      // NOMINAL-PULANG-CEPAT (AL = 40.000*0.25, flat bila ada kejadian)
      if (hasMaster('NOMINAL-PLG-CEPAT')) {
        const amount = attendanceSummary.earlyLeaveCount > 0 ? new Decimal(10000) : new Decimal(0);
        pushMaster('NOMINAL-PLG-CEPAT', amount, '40.000 x 0,25');
      }

      // Manual deductions: HR mengisi via penyesuaian
      for (const code of ['KELALAIAN', 'PENYESUAIAN']) {
        if (hasMaster(code)) {
          pushMaster(code, new Decimal(0), 'Manual — diisi HR');
        }
      }

      // Custom HR masters (di luar 22 bawaan): resolusi generik per sumber
      const KNOWN_CODES = new Set([
        'GAJI-POKOK', 'TOTAL-GAJI-HARIAN', 'TUNJ-MASA-KERJA', 'SELISIH',
        'TUNJ-JABATAN', 'TUNJ-KELUARGA', 'TUNJ-PENDIDIKAN', 'TRANSPORTASI',
        'NOMINAL-LEMBUR', 'TOTAL-KPI', 'KEKURANGAN-BLN-LALU', 'NOMINAL-TFS',
        'NOMINAL-BA', 'NOMINAL-LBL-LIBUR', 'NOMINAL-PLG-CEPAT', 'KELALAIAN', 'PENYESUAIAN',
      ]);
      const gradeCode = (employee as any).position?.grade?.code as string | undefined;
      for (const { master, notes } of selectedMasters) {
        if (KNOWN_CODES.has(master.code)) continue;
        let amount = new Decimal(0);
        let formula = 'Manual — diisi HR';
        if (master.source === 'fixed') {
          amount = master.defaultAmount ? new Decimal(master.defaultAmount.toString()) : new Decimal(0);
          formula = 'Nominal tetap master';
        } else if (master.source === 'grade') {
          const tiers = (master.tiers || {}) as Record<string, any>;
          const v = gradeCode ? Number(tiers[gradeCode]) : NaN;
          amount = Number.isFinite(v) ? new Decimal(v) : new Decimal(0);
          formula = gradeCode ? `Grade ${gradeCode}` : 'Grade karyawan belum diset';
        } else if (master.source === 'computed') {
          formula = 'Belum ada resolver untuk sumber ini';
        }
        components.push({
          type: master.category,
          name: master.name,
          amount,
          formula,
          notes: notes || undefined,
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

  /**
   * IGDERP-275: set or change the employee payslip PIN.
   * First set needs no old PIN; changing requires the current one.
   */
  async setPayslipPin(userId: string, dto: SetPayslipPinDto) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');

    if (employee.payslipPinHash) {
      if (!dto.oldPin) {
        throw new BadRequestException('Current PIN is required to change PIN');
      }
      const ok = await this.passwordService.comparePassword(dto.oldPin, employee.payslipPinHash);
      if (!ok) throw new ForbiddenException('Current PIN is incorrect');
    }

    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { payslipPinHash: await this.passwordService.hashPassword(dto.pin) },
    });
    return { message: 'Payslip PIN saved' };
  }

  /** Resolve the caller's employee row or 404. */
  private async ownEmployee(userId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { userId } });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  /** PIN gate for all self-service slip reads. Default PIN is 123456 until the employee sets their own. */
  private async assertPayslipPin(employee: { payslipPinHash: string | null }, pin: string) {
    if (!employee.payslipPinHash) {
      if (pin !== '123456') throw new ForbiddenException('Incorrect payslip PIN');
      return;
    }
    const ok = await this.passwordService.comparePassword(pin, employee.payslipPinHash);
    if (!ok) throw new ForbiddenException('Incorrect payslip PIN');
  }

  /**
   * IGDERP-275: list own payroll slips (periods + totals) after PIN check.
   */
  async mySlips(userId: string, pin: string) {
    const employee = await this.ownEmployee(userId);
    await this.assertPayslipPin(employee, pin);
    const rows = await this.prisma.payroll.findMany({
      where: { employeeId: employee.id },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
    return {
      data: rows.map((p) => ({
        id: p.id,
        payrollNumber: p.payrollNumber,
        periodMonth: p.periodMonth,
        periodYear: p.periodYear,
        status: p.status,
        totalEarnings: p.totalEarnings.toNumber(),
        totalDeductions: p.totalDeductions.toNumber(),
        nettSalary: p.nettSalary.toNumber(),
      })),
      total: rows.length,
      hasPin: true,
    };
  }

  /**
   * IGDERP-275: full slip detail (components included) after PIN check.
   * Only the owner's own slip can be unlocked.
   */
  async unlockSlip(userId: string, payrollId: string, pin: string) {
    const employee = await this.ownEmployee(userId);
    await this.assertPayslipPin(employee, pin);
    const slip: any = await this.findById(payrollId);
    if (slip.employeeId !== employee.id) {
      throw new ForbiddenException('You can only open your own payslip');
    }
    return slip;
  }
}

