import {
  Controller,
  Get,
  Post,
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
    return this.opnameService.findAll(branchId, status, branchIds);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async findById(@Param('id') id: string) {
    return this.opnameService.findById(id);
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
  async addItem(@Param('id') id: string, @Body() dto: AddOpnameItemDto) {
    return this.opnameService.addItem(id, dto.productId);
  }

  /** Draft model: remove a row from the ongoing opname (IGDERP-175: item id). */
  @Delete(':id/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO')
  async removeItem(@Param('id') id: string, @Param('itemId') itemId: string) {
    return this.opnameService.removeItem(id, itemId);
  }

  @Post(':id/items')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO')
  async recordCount(
    @Param('id') id: string,
    @Body() dto: RecordCountDto,
    @Request() req: any,
  ) {
    return this.opnameService.recordCount(id, dto, req.user.id);
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
  async approveOpname(@Param('id') id: string, @Request() req: any) {
    return this.opnameService.approveOpname(id, req.user.id);
  }
}
