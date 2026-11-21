import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { ApprovalsService } from './services/approvals.service';

interface ExpressRequest extends Request {
  user: {
    id: string;
    roles: string[];
    branchIds?: string[] | null;
  };
}

/**
 * IGDERP-275: unified pending-approvals inbox (dashboard + HP app).
 */
@Controller('approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  /**
   * Pending approvals awaiting the caller's decision
   * GET /api/v1/approvals/pending
   */
  @Get('pending')
  async pending(@Request() req: ExpressRequest) {
    return this.approvalsService.pendingApprovals(req.user.id, req.user.roles || [], req.user.branchIds);
  }
}
