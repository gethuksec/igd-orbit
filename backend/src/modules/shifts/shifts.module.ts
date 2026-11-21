import { Module } from '@nestjs/common';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { ShiftAssignmentsController } from './shift-assignments.controller';
import { ShiftAssignmentsService } from './shift-assignments.service';
import { ShiftRosterController } from './shift-roster.controller';
import { ShiftRosterService } from './shift-roster.service';
import { PrismaService } from '../../shared/services';

/**
 * Shifts Module — work schedules + employee assignments
 */
@Module({
  controllers: [ShiftsController, ShiftAssignmentsController, ShiftRosterController],
  providers: [ShiftsService, ShiftAssignmentsService, ShiftRosterService, PrismaService],
  exports: [ShiftsService, ShiftAssignmentsService, ShiftRosterService],
})
export class ShiftsModule {}
