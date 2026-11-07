import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { resolveBranchFilter } from '../../common/branch-access.util';
import { StockOpnameService } from './stock-opname.service';
import { StartOpnameDto } from './dto/start-opname.dto';
import { RecordCountDto } from './dto/record-count.dto';
import { AddOpnameItemDto } from './dto/add-opname-item.dto';
import { AddAssignmentDto } from './dto/add-assignment.dto';
import { LogExceptionDto } from './dto/log-exception.dto';
import { UpsertApproverSettingDto } from './dto/upsert-approver-setting.dto';

@Controller('inventory/opname')
@UseGuards(JwtAuthGuard)
export class StockOpnameController {
  constructor(private readonly opnameService: StockOpnameService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CSO')
  async startOpname(@Body() dto: StartOpnameDto, @Request() req: any) {
    return this.opnameService.startOpname(dto, req.user.id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async findAll(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    // "Semua Cabang" default (22-Agu-2026): no branchId → restrict to user's branches
    let branchIds: string[] | undefined;
    if (!branchId) {
      branchIds = resolveBranchFilter(req, undefined).branchIds;
    }
    // IGDERP-234 (OP2): blind list rows for counters.
    return this.opnameService.findAll(branchId, status, branchIds, { roles: req.user.roles });
  }

  @Get('code/:code')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async findByCode(@Param('code') code: string, @Request() req: any) {
    return this.opnameService.findByCode(code, { roles: req.user.roles });
  }

  // IGDERP-236 (OP4): single-segment statics must stay above ':id' or Express
  // matches them as an id. (Same reason 'code/:code' lives up here.)
  /** Approver setting (Administrator → General). */
  @Get('approver-setting')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async getApproverSetting() {
    return this.opnameService.getApproverSetting();
  }

  /** Update the approver setting (global role or per-outlet person). */
  @Put('approver-setting')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'SUPERADMIN')
  async upsertApproverSetting(@Body() dto: UpsertApproverSettingDto, @Request() req: any) {
    return this.opnameService.upsertApproverSetting(dto, req.user.id);
  }

  /** Approver candidates for an outlet (start-form prefill). */
  @Get('approver-candidates')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CSO', 'OWNER', 'SUPERADMIN')
  async getApproverCandidates(@Query('outletId') outletId: string) {
    return this.opnameService.getApproverCandidates(outletId);
  }

  /** IGDERP-234 (OP2): counter-facing count view (scoped + blind). */
  @Get(':id/count-view')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async getCountView(@Param('id') id: string, @Request() req: any) {
    return this.opnameService.getCountView(id, req.user);
  }

  /** IGDERP-234 (OP2): resolve a scanned barcode/SKU (identity only). */
  @Get(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO', 'SPV', 'CSO')
  async resolveBarcode(
    @Param('id') id: string,
    @Query('barcode') barcode: string,
    @Request() req: any,
  ) {
    return this.opnameService.resolveBarcode(id, barcode, req.user);
  }

  /** IGDERP-234 (OP2): session progress — who counted what. */
  @Get(':id/progress')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async getProgress(@Param('id') id: string) {
    return this.opnameService.getProgress(id);
  }

  /** IGDERP-234 (OP2): assignment roster. */
  @Get(':id/assignments')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async listAssignments(@Param('id') id: string) {
    return this.opnameService.listAssignments(id);
  }

  /** IGDERP-234 (OP2): assign a counter to categories (addable mid-session). */
  @Post(':id/assignments')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CSO')
  async addAssignments(@Param('id') id: string, @Body() dto: AddAssignmentDto) {
    return this.opnameService.addAssignments(id, dto);
  }

  /** IGDERP-234 (OP2): unknown-barcode exception log. */
  @Get(':id/exceptions')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CSO')
  async listExceptions(@Param('id') id: string) {
    return this.opnameService.listExceptions(id);
  }

  /** IGDERP-234 (OP2): log an unknown-barcode scan (never a count line). */
  @Post(':id/exceptions')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO')
  async logException(@Param('id') id: string, @Body() dto: LogExceptionDto, @Request() req: any) {
    return this.opnameService.logException(id, dto.barcode, req.user.id);
  }

  /** IGDERP-235 (OP3): variance review (selisih-first for the C2 layout). */
  @Get(':id/review')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async getReview(@Param('id') id: string, @Request() req: any) {
    return this.opnameService.getReview(id, { roles: req.user.roles });
  }

  @Get('code/:code')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async findByCode(@Param('code') code: string) {
    return this.opnameService.findByCode(code);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async findById(@Param('id') id: string, @Request() req: any) {
    // IGDERP-234 (OP2): blind detail for counters.
    return this.opnameService.findById(id, { roles: req.user.roles });
  }

  /** IGDERP-177: result document download (.xlsx). */
  @Get(':id/export')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async exportOpname(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.opnameService.exportOpname(id);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  }

  /** Draft model: add a product to the ongoing opname. */
  @Post(':id/items/add')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO')
  async addItem(@Param('id') id: string, @Body() dto: AddOpnameItemDto, @Request() req: any) {
    return this.opnameService.addItem(id, dto.productId, req.user);
  }

  /** Draft model: remove a row from the ongoing opname (IGDERP-175: item id). */
  @Delete(':id/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO')
  async removeItem(@Param('id') id: string, @Param('itemId') itemId: string, @Request() req: any) {
    return this.opnameService.removeItem(id, itemId, req.user);
  }

  @Post(':id/items')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO')
  async recordCount(
    @Param('id') id: string,
    @Body() dto: RecordCountDto,
    @Request() req: any,
  ) {
    return this.opnameService.recordCount(id, dto, req.user.id, req.user.roles);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO', 'SPV')
  async cancelOpname(@Param('id') id: string, @Request() req: any) {
    return this.opnameService.cancelOpname(id, req.user.id);
  }

  @Post(':id/complete')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO')
  async completeOpname(@Param('id') id: string, @Request() req: any) {
    return this.opnameService.completeOpname(id, req.user.id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('SPV', 'CSO')
  async approveOpname(@Param('id') id: string, @Request() req: any, @Body() body?: { note?: string }) {
    // IGDERP-236 (OP4): assigned-approver enforcement happens in the service (403).
    return this.opnameService.approveOpname(id, req.user.id, req.user.roles, body?.note);
  }

  /** IGDERP-236 (OP4): approval history (append-only). */
  @Get(':id/approvals')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CSO', 'OWNER', 'SUPERADMIN')
  async listApprovals(@Param('id') id: string) {
    return this.opnameService.listApprovals(id);
  }

  /** IGDERP-236 (OP4): correction history (append-only). */
  @Get(':id/corrections')
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CSO', 'OWNER', 'SUPERADMIN')
  async listCorrections(@Param('id') id: string) {
    return this.opnameService.listCorrections(id);
  }
}
