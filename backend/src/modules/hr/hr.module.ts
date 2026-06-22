import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { AttendanceService } from './services/attendance.service';
import { LeaveService } from './services/leave.service';
import { PayrollService } from './services/payroll.service';
import { KPIService } from './services/kpi.service';
import { DepartmentsService } from './services/departments.service';
import { AttendanceController } from './attendance.controller';
import { LeaveController } from './leave.controller';
import { PayrollController } from './payroll.controller';
import { KPIController } from './kpi.controller';
import { DepartmentsController } from './departments.controller';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [
    AttendanceController,
    LeaveController,
    PayrollController,
    KPIController,
    DepartmentsController,
  ],
  providers: [
    PrismaService,
    AttendanceService,
    LeaveService,
    PayrollService,
    KPIService,
    DepartmentsService,
  ],
  exports: [
    AttendanceService,
    LeaveService,
    PayrollService,
    KPIService,
    DepartmentsService,
  ],
})
export class HRModule {}

