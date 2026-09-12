import { Body, Controller, Get, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { LabelPrintingService } from './label-printing.service';
import { MarkLabelsPrintedDto, UpdateLabelSettingDto } from './dto/label-printing.dto';

/** Roles allowed to view the queue / print from the queue. */
const PRINT_ROLES = [
  'SUPERADMIN',
  'OWNER',
  'CFO',
  'MGR',
  'CHR',
  'SPV',
  'CSO',
  'HS',
  'ASA',
  'SODO',
];
/** Roles allowed to change printer/label settings. */
const SETTINGS_ROLES = ['SUPERADMIN', 'OWNER', 'CHR', 'CFO', 'MGR'];

@Controller('label-printing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LabelPrintingController {
  constructor(private readonly labelPrintingService: LabelPrintingService) {}

  @Get('settings')
  @Roles(...PRINT_ROLES)
  getSettings() {
    return this.labelPrintingService.getSettings();
  }

  @Put('settings')
  @Roles(...SETTINGS_ROLES)
  updateSettings(@Body() dto: UpdateLabelSettingDto, @Request() req: any) {
    return this.labelPrintingService.updateSettings(dto, req.user.id);
  }

  @Get('jobs')
  @Roles(...PRINT_ROLES)
  listJobs(
    @Query('status') status?: string,
    @Query('goods_receipt_id') goodsReceiptId?: string,
    @Query('ids') ids?: string,
  ) {
    return this.labelPrintingService.listJobs({ status, goodsReceiptId, ids });
  }

  @Post('jobs/mark-printed')
  @Roles(...PRINT_ROLES)
  markPrinted(@Body() dto: MarkLabelsPrintedDto, @Request() req: any) {
    return this.labelPrintingService.markPrinted(dto, req.user.id);
  }
}
