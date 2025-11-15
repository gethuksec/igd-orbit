import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { AttendanceService } from './services/attendance.service';
import { LeaveService } from './services/leave.service';
import { PayrollService } from './services/payroll.service';
import { KPIService } from './services/kpi.service';
import { AttendanceController } from './attendance.controller';
import { LeaveController } from './leave.controller';
import { PayrollController } from './payroll.controller';
import { KPIController } from './kpi.controller';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [FinanceModule],
  controllers: [
    AttendanceController,
    LeaveController,
    PayrollController,
    KPIController,
  ],
  providers: [
    PrismaService,
    AttendanceService,
    LeaveService,
    PayrollService,
    KPIService,
  ],
  exports: [
    AttendanceService,
    LeaveService,
    PayrollService,
    KPIService,
  ],
})
export class HRModule {}

