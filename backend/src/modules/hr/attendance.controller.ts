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
import { AttendanceService } from './services/attendance.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
import { ManualAdjustmentDto } from './dto/manual-adjustment.dto';
import { OvertimeRequestDto } from './dto/overtime-request.dto';

interface ExpressRequest extends Request {
  user: {
    id: string;
    roles: string[];
  };
}

@Controller('attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * Clock in
   * POST /api/v1/attendance/clock-in
   */
  @Post('clock-in')
  async clockIn(@Request() req: ExpressRequest, @Body() dto: ClockInDto) {
    return this.attendanceService.clockIn(req.user.id, dto);
  }

  /**
   * Clock out
   * POST /api/v1/attendance/clock-out
   */
  @Post('clock-out')
  async clockOut(@Request() req: ExpressRequest, @Body() dto: ClockOutDto) {
    return this.attendanceService.clockOut(req.user.id, dto);
  }

  /**
   * List attendance records
   * GET /api/v1/attendance
   */
  @Get()
  async findAll(
    @Request() req: ExpressRequest,
    @Query('employeeId') employeeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.attendanceService.findAll(req.user.id, employeeId, start, end);
  }

  /**
   * Get monthly summary
   * GET /api/v1/attendance/summary
   */
  @Get('summary')
  async getMonthlySummary(
    @Request() req: ExpressRequest,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.attendanceService.getMonthlySummary(
      req.user.id,
      parseInt(month, 10),
      parseInt(year, 10),
    );
  }

  /**
   * Manual adjustment
   * POST /api/v1/attendance/:id/adjust
   */
  @Post(':id/adjust')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CHR')
  async manualAdjustment(
    @Request() req: ExpressRequest,
    @Param('id') id: string,
    @Body() dto: ManualAdjustmentDto,
  ) {
    return this.attendanceService.manualAdjustment(
      { ...dto, attendance_id: id },
      req.user.id,
      req.user.roles,
    );
  }

  /**
   * Request overtime
   * POST /api/v1/attendance/overtime/request
   */
  @Post('overtime/request')
  async requestOvertime(
    @Request() req: ExpressRequest,
    @Body() dto: OvertimeRequestDto,
  ) {
    return this.attendanceService.requestOvertime(req.user.id, dto);
  }

  /**
   * Approve overtime
   * POST /api/v1/attendance/overtime/approve
   */
  @Post('overtime/approve')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV')
  async approveOvertime(
    @Request() req: ExpressRequest,
    @Query('id') overtimeId: string,
  ) {
    return this.attendanceService.approveOvertime(
      overtimeId,
      req.user.id,
      req.user.roles,
    );
  }
}

