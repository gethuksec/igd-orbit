import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { PasswordService } from '../../shared/services/password.service';
import { AttendanceService } from './services/attendance.service';
import { LeaveService } from './services/leave.service';
import { ApprovalsService } from './services/approvals.service';
import { ShiftSwapService } from './services/shift-swap.service';
import { PayrollService } from './services/payroll.service';
import { KPIService } from './services/kpi.service';
import { DepartmentsService } from './services/departments.service';
import { DivisionsService } from './services/divisions.service';
import { GradesService } from './services/grades.service';
import { PositionsService } from './services/positions.service';
import { PayrollComponentsService } from './services/payroll-components.service';
import { AttendanceController } from './attendance.controller';
import { LeaveController } from './leave.controller';
import { ApprovalsController } from './approvals.controller';
import { ShiftSwapController } from './shift-swap.controller';
import { PayrollController } from './payroll.controller';
import { KPIController } from './kpi.controller';
import { DepartmentsController } from './departments.controller';
import { DivisionsController } from './divisions.controller';
import { GradesController } from './grades.controller';
import { PositionsController } from './positions.controller';
import { PayrollComponentsController } from './payroll-components.controller';
import { FinanceModule } from '../finance/finance.module';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [FinanceModule, ShiftsModule],
  controllers: [
    AttendanceController,
    LeaveController,
    ApprovalsController,
    ShiftSwapController,
    PayrollController,
    KPIController,
    DepartmentsController,
    DivisionsController,
    GradesController,
    PositionsController,
    PayrollComponentsController,
  ],
  providers: [
    PrismaService,
    PasswordService,
    AttendanceService,
    LeaveService,
    ApprovalsService,
    ShiftSwapService,
    PayrollService,
    KPIService,
    DepartmentsService,
    DivisionsService,
    GradesService,
    PositionsService,
    PayrollComponentsService,
  ],
  exports: [
    AttendanceService,
    LeaveService,
    ApprovalsService,
    ShiftSwapService,
    PayrollService,
    KPIService,
    DepartmentsService,
    DivisionsService,
    GradesService,
    PositionsService,
    PayrollComponentsService,
  ],
})
export class HRModule {}

