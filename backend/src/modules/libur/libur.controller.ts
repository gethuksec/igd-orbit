import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LiburService } from './libur.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import {
  CreateLiburRequestDto,
  ListLiburQuotasDto,
  ListLiburRequestsDto,
  RejectLiburRequestDto,
  UpdateEmployeeQuotaDto,
  UpdateGlobalQuotaDto,
  BulkDecideLiburDto,
} from './dto';

const READ_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS', 'HS', 'CHR'];
const WRITE_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'CHR'];
const ATASAN_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'CHR', 'HS', 'MS', 'SPV'];

interface AuthedRequest extends Request {
  user: { id: string; roles: string[] };
}

/**
 * Libur Controller — monthly off-day quotas + requests
 */
@Controller('libur')
@UseGuards(JwtAuthGuard)
export class LiburController {
  constructor(private readonly svc: LiburService) {}

  @Get('quotas')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async getQuotas(@Query() query: ListLiburQuotasDto) {
    return this.svc.getQuotas(query);
  }

  @Put('quotas/global')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async updateGlobalQuota(@Body() dto: UpdateGlobalQuotaDto, @Request() req: AuthedRequest) {
    return this.svc.updateGlobalQuota(dto, req.user?.id);
  }

  @Put('quotas/:employeeId')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async updateEmployeeQuota(
    @Param('employeeId') employeeId: string,
    @Body() dto: UpdateEmployeeQuotaDto,
    @Request() req: AuthedRequest,
  ) {
    return this.svc.updateEmployeeQuota(employeeId, dto, req.user?.id);
  }

  @Get('requests')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async listRequests(@Query() query: ListLiburRequestsDto) {
    return this.svc.listRequests(query);
  }

  @Post('requests')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  async createRequest(@Body() dto: CreateLiburRequestDto, @Request() req: AuthedRequest) {
    return this.svc.createRequest(dto, req.user.id);
  }

  @Post('requests/bulk-approve')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async bulkApprove(@Body() dto: BulkDecideLiburDto, @Request() req: AuthedRequest) {
    return this.svc.bulkApprove(dto, req.user.id);
  }

  @Post('requests/bulk-reject')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async bulkReject(@Body() dto: BulkDecideLiburDto, @Request() req: AuthedRequest) {
    return this.svc.bulkReject(dto, req.user.id);
  }

  @Post('requests/:id/atasan-approve')
  @UseGuards(RolesGuard)
  @Roles(...ATASAN_ROLES)
  async atasanApprove(@Param('id') id: string, @Request() req: AuthedRequest) {
    return this.svc.atasanApprove(id, req.user.id);
  }

  @Post('requests/:id/atasan-reject')
  @UseGuards(RolesGuard)
  @Roles(...ATASAN_ROLES)
  async atasanReject(
    @Param('id') id: string,
    @Body() dto: RejectLiburRequestDto,
    @Request() req: AuthedRequest,
  ) {
    return this.svc.atasanReject(id, dto, req.user.id);
  }

  @Post('requests/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async approveRequest(@Param('id') id: string, @Request() req: AuthedRequest) {
    return this.svc.approveRequest(id, req.user.id);
  }

  @Post('requests/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async rejectRequest(
    @Param('id') id: string,
    @Body() dto: RejectLiburRequestDto,
    @Request() req: AuthedRequest,
  ) {
    return this.svc.rejectRequest(id, dto, req.user.id);
  }

  @Post('requests/:id/cancel')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async cancelRequest(@Param('id') id: string) {
    return this.svc.cancelRequest(id);
  }
}
