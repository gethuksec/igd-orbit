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
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { LeaveService } from './services/leave.service';
import { PrismaService } from '../../shared/services/prisma.service';
import { LeaveRequestDto } from './dto/leave-request.dto';
import { ApproveLeaveDto } from './dto/approve-leave.dto';
import { RejectLeaveDto } from './dto/reject-leave.dto';
import { CancelLeaveDto } from './dto/cancel-leave.dto';

interface ExpressRequest extends Request {
  user: {
    id: string;
    roles: string[];
  };
}

@Controller('leave')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(
    private readonly leaveService: LeaveService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Supporting-document upload for leave requests
   * POST /api/v1/leave/attachment (multipart: file) → { url }
   */
  @Post('attachment')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    }),
  )
  async uploadAttachment(
    @Request() req: ExpressRequest,
    @UploadedFile() file?: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException('File lampiran wajib diunggah (field: file)');
    return this.leaveService.uploadAttachment(file, req.user.id);
  }

  /**
   * Request leave
   * POST /api/v1/leave/request
   */
  @Post('request')
  async requestLeave(@Request() req: ExpressRequest, @Body() dto: LeaveRequestDto) {
    return this.leaveService.requestLeave(dto, req.user.id);
  }

  /**
   * List leave requests
   * GET /api/v1/leave/requests
   */
  @Get('requests')
  async findAll(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;
    return this.leaveService.findAll(employeeId, status, start, end);
  }

  /**
   * Get leave balance
   * GET /api/v1/leave/balance/:userId
   */
  @Get('balance/:userId')
  async getLeaveBalance(@Param('userId') userId: string) {
    // Get employee by userId
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    return this.leaveService.getLeaveBalance(employee.id);
  }

  /**
   * Approve leave
   * POST /api/v1/leave/approve
   */
  @Post('approve')
  @UseGuards(RolesGuard)
  // N+1: the service enforces the direct-atasan check; the gate stays open
  // so L5/L4/L3 atasans (AS-SE, SPV-*, HS, MO, ...) are not blocked.
  // SUPERADMIN still bypasses at guard level; OWNER via service bypass.
  async approveLeave(
    @Request() req: ExpressRequest,
    @Query('id') leaveId: string,
    @Body() dto: ApproveLeaveDto,
  ) {
    return this.leaveService.approveLeave(leaveId, dto, req.user.id, req.user.roles);
  }

  /**
   * Approve leave — step 2 / final (HR: CHR)
   * POST /api/v1/leave/approve-hr?id=
   */
  @Post('approve-hr')
  @UseGuards(RolesGuard)
  @Roles('CHR')
  async approveLeaveHr(
    @Request() req: ExpressRequest,
    @Query('id') leaveId: string,
  ) {
    return this.leaveService.approveLeaveHr(leaveId, req.user.id, req.user.roles);
  }

  /**
   * Reject leave
   * POST /api/v1/leave/reject
   */
  @Post('reject')
  @UseGuards(RolesGuard)
  // N+1: pending rejects are atasan-only (service-enforced, CHR included
  // only after manager approval); the gate stays open for line atasans.
  async rejectLeave(
    @Request() req: ExpressRequest,
    @Query('id') leaveId: string,
    @Body() dto: RejectLeaveDto,
  ) {
    return this.leaveService.rejectLeave(leaveId, dto, req.user.id, req.user.roles);
  }

  /**
   * Cancel leave
   * POST /api/v1/leave/cancel
   */
  @Post('cancel')
  async cancelLeave(
    @Request() req: ExpressRequest,
    @Query('id') leaveId: string,
    @Body() dto: CancelLeaveDto,
  ) {
    return this.leaveService.cancelLeave(leaveId, dto, req.user.id);
  }
}

