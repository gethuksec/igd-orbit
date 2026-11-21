import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ShiftRosterService, AuthedShiftUser } from './shift-roster.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { DivisionOverlayQueryDto, RosterQueryDto, SubmitRosterDto } from './dto';

const READ_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS', 'HS', 'CHR'];
const WRITE_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'CHR'];

interface AuthedRequest extends Request {
  user: AuthedShiftUser;
}

/**
 * ShiftRosterController — roster-first plotting (WS-288):
 * per-employee roster table, same-division overlay, full-range submit.
 */
@Controller('shift-roster')
@UseGuards(JwtAuthGuard)
export class ShiftRosterController {
  constructor(private readonly svc: ShiftRosterService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async getRoster(@Query() query: RosterQueryDto, @Request() req: AuthedRequest) {
    return this.svc.getRoster(req.user, query);
  }

  @Get('division')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async getDivisionOverlay(@Query() query: DivisionOverlayQueryDto, @Request() req: AuthedRequest) {
    return this.svc.getDivisionOverlay(req.user, query);
  }

  @Get('assign/:employeeId')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async getAssignContext(
    @Param('employeeId') employeeId: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Request() req: AuthedRequest,
  ) {
    return this.svc.getAssignContext(req.user, employeeId, start, end);
  }

  @Post('submit')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async submitRoster(@Body() dto: SubmitRosterDto, @Request() req: AuthedRequest) {
    return this.svc.submitRoster(req.user, dto);
  }
}
