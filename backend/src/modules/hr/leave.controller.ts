import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
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
  @Roles('HS', 'SPV', 'CHR')
  async approveLeave(
    @Request() req: ExpressRequest,
    @Query('id') leaveId: string,
    @Body() dto: ApproveLeaveDto,
  ) {
    return this.leaveService.approveLeave(leaveId, dto, req.user.id, req.user.roles);
  }

  /**
   * Reject leave
   * POST /api/v1/leave/reject
   */
  @Post('reject')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CHR')
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

