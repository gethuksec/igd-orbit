import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ShiftSwapService } from './services/shift-swap.service';
import { ShiftSwapRequestDto } from './dto/shift-swap-request.dto';
import { RejectShiftSwapDto } from './dto/reject-shift-swap.dto';

interface ExpressRequest extends Request {
  user: {
    id: string;
    roles: string[];
  };
}

/**
 * IGDERP-275: shift swap (tukar shift) — file, list, 2-step approval.
 */
@Controller('shift-swap')
@UseGuards(JwtAuthGuard)
export class ShiftSwapController {
  constructor(private readonly shiftSwapService: ShiftSwapService) {}

  /**
   * File a shift swap request
   * POST /api/v1/shift-swap/request
   */
  @Post('request')
  async requestSwap(@Request() req: ExpressRequest, @Body() dto: ShiftSwapRequestDto) {
    return this.shiftSwapService.requestSwap(dto, req.user.id);
  }

  /**
   * List shift swap requests
   * GET /api/v1/shift-swap/requests
   */
  @Get('requests')
  async findAll(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: string,
  ) {
    return this.shiftSwapService.findAll(employeeId, status);
  }

  /**
   * Approve — step 1 (manager: HS/SPV)
   * POST /api/v1/shift-swap/approve?id=
   */
  @Post('approve')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV')
  async approve(@Request() req: ExpressRequest, @Query('id') swapId: string) {
    return this.shiftSwapService.approve(swapId, req.user.id, req.user.roles);
  }

  /**
   * Approve — step 2 / final (HR: CHR); swaps assignments on success
   * POST /api/v1/shift-swap/approve-hr?id=
   */
  @Post('approve-hr')
  @UseGuards(RolesGuard)
  @Roles('CHR')
  async approveHr(@Request() req: ExpressRequest, @Query('id') swapId: string) {
    return this.shiftSwapService.approveHr(swapId, req.user.id, req.user.roles);
  }

  /**
   * Reject
   * POST /api/v1/shift-swap/reject?id=
   */
  @Post('reject')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CHR')
  async reject(
    @Request() req: ExpressRequest,
    @Query('id') swapId: string,
    @Body() dto: RejectShiftSwapDto,
  ) {
    return this.shiftSwapService.reject(swapId, dto, req.user.id, req.user.roles);
  }

  /**
   * Cancel own request
   * POST /api/v1/shift-swap/cancel?id=
   */
  @Post('cancel')
  async cancel(@Request() req: ExpressRequest, @Query('id') swapId: string) {
    return this.shiftSwapService.cancel(swapId, req.user.id);
  }
}
