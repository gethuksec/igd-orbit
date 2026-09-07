import { Body, Controller, Get, Param, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ApprovalSettingsService } from './approval-settings.service';
import { UpsertApprovalSettingDto } from './dto/upsert-approval-setting.dto';

@Controller('approval-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ApprovalSettingsController {
  constructor(private readonly approvalSettingsService: ApprovalSettingsService) {}

  @Get()
  @Roles('SUPERADMIN', 'OWNER', 'CHR', 'CFO', 'MGR')
  findAll() {
    return this.approvalSettingsService.findAll();
  }

  @Put(':category')
  @Roles('SUPERADMIN', 'OWNER', 'CHR', 'CFO', 'MGR')
  upsert(
    @Param('category') category: string,
    @Body() dto: UpsertApprovalSettingDto,
    @Request() req: any,
  ) {
    return this.approvalSettingsService.upsert({ ...dto, category } as UpsertApprovalSettingDto, req.user.id);
  }
}
