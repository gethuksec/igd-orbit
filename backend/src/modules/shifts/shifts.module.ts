import { Module } from '@nestjs/common';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
import { ShiftAssignmentsController } from './shift-assignments.controller';
import { ShiftAssignmentsService } from './shift-assignments.service';
import { PrismaService } from '../../shared/services';

/**
 * Shifts Module — work schedules + employee assignments
 */
@Module({
  controllers: [ShiftsController, ShiftAssignmentsController],
  providers: [ShiftsService, ShiftAssignmentsService, PrismaService],
  exports: [ShiftsService, ShiftAssignmentsService],
})
export class ShiftsModule {}
