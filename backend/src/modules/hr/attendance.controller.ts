import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { resolveBranchFilter } from '../../common/branch-access.util';
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
   * Reject overtime
   * POST /api/v1/attendance/overtime/reject?id= (body: { reason })
   */
  @Post('overtime/reject')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CHR')
  async rejectOvertime(
    @Request() req: ExpressRequest,
    @Query('id') overtimeId: string,
    @Body() body: { reason: string },
  ) {
    return this.attendanceService.rejectOvertime(
      overtimeId,
      body?.reason,
      req.user.id,
      req.user.roles,
    );
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
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('branchId') branchId?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    // Only filter by userId if user doesn't have high-level roles (for viewing all)
    const hasHighLevelRole = ['OWNER', 'CFO', 'CHR', 'HS', 'SPV'].some((role) => req.user.roles.includes(role));
    const userId = hasHighLevelRole ? undefined : req.user.id;
    // "Semua Cabang" default (22-Agu-2026): no branchId → restrict to user's branches
    let branchIds: string[] | undefined;
    if (!branchId) {
      branchIds = resolveBranchFilter(req, undefined).branchIds;
    }
    return this.attendanceService.findAll(userId, employeeId, start, end, search, status, branchId, branchIds);
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
   * List overtime requests (approval queue)
   * GET /api/v1/attendance/overtime/requests
   */
  @Get('overtime/requests')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS', 'HS', 'CHR', 'SPV')
  async listOvertimeRequests(@Query('status') status?: string) {
    return this.attendanceService.listOvertimeRequests(status);
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
   * Selfie upload for mobile clock in/out
   * POST /api/v1/attendance/selfie (multipart: photo)
   * Returns { url } to send as photoUrl in clock-in/out.
   */
  @Post('selfie')
  @UseInterceptors(
    FileInterceptor('photo', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    }),
  )
  async uploadSelfie(
    @Request() req: ExpressRequest,
    @UploadedFile() file?: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException('Foto selfie wajib diunggah (field: photo)');
    return this.attendanceService.uploadSelfie(file, req.user.id);
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
   * Approve overtime — step 1 (manager: HS/SPV)
   * POST /api/v1/attendance/overtime/approve?id=
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

  /**
   * Approve overtime — step 2 / final (HR: CHR)
   * POST /api/v1/attendance/overtime/approve-hr?id=
   */
  @Post('overtime/approve-hr')
  @UseGuards(RolesGuard)
  @Roles('CHR')
  async approveOvertimeHr(
    @Request() req: ExpressRequest,
    @Query('id') overtimeId: string,
  ) {
    return this.attendanceService.approveOvertimeHr(
      overtimeId,
      req.user.id,
      req.user.roles,
    );
  }
}

