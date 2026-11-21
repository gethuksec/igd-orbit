import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { AttendanceService } from './services/attendance.service';
import { LeaveService } from './services/leave.service';
import { PayrollService } from './services/payroll.service';
import { KPIService } from './services/kpi.service';
import { DepartmentsService } from './services/departments.service';
import { DivisionsService } from './services/divisions.service';
import { GradesService } from './services/grades.service';
import { PositionsService } from './services/positions.service';
import { AttendanceController } from './attendance.controller';
import { LeaveController } from './leave.controller';
import { PayrollController } from './payroll.controller';
import { KPIController } from './kpi.controller';
import { DepartmentsController } from './departments.controller';
import { DivisionsController } from './divisions.controller';
import { GradesController } from './grades.controller';
import { PositionsController } from './positions.controller';
import { FinanceModule } from '../finance/finance.module';
import { ShiftsModule } from '../shifts/shifts.module';

@Module({
  imports: [FinanceModule, ShiftsModule],
  controllers: [
    AttendanceController,
    LeaveController,
    PayrollController,
    KPIController,
    DepartmentsController,
    DivisionsController,
    GradesController,
    PositionsController,
  ],
  providers: [
    PrismaService,
    AttendanceService,
    LeaveService,
    PayrollService,
    KPIService,
    DepartmentsService,
    DivisionsService,
    GradesService,
    PositionsService,
  ],
  exports: [
    AttendanceService,
    LeaveService,
    PayrollService,
    KPIService,
    DepartmentsService,
    DivisionsService,
    GradesService,
    PositionsService,
  ],
})
export class HRModule {}

