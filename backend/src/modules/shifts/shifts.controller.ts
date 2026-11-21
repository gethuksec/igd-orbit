import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  BadRequestException,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateShiftDto, UpdateShiftDto, ListShiftsDto, UpsertShiftSettingDto } from './dto';

const READ_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS', 'HS', 'CHR'];
const WRITE_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'CHR'];

/**
 * Shifts Controller — work-schedule master-data endpoints
 */
@Controller('shifts')
@UseGuards(JwtAuthGuard)
export class ShiftsController {
  constructor(private readonly svc: ShiftsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async findAll(@Query() query: ListShiftsDto) {
    try {
      return await this.svc.findAll(query);
    } catch (error) {
      console.error('Error in shift.findAll:', error);
      throw error;
    }
  }

  // ---------- IGDERP-265 gaps: static routes BEFORE ':id' ----------

  @Get('settings/current')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async getSetting() {
    return this.svc.getSetting();
  }

  @Get('current')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async resolveCurrent(@Query('employeeId') employeeId: string, @Query('date') date: string) {
    if (!employeeId || !date) {
      throw new BadRequestException('employeeId and date (YYYY-MM-DD) are required');
    }
    return this.svc.resolveShiftForDate(employeeId, date);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateShiftDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async update(@Param('id') id: string, @Body() dto: UpdateShiftDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.svc.delete(id);
  }

  // ---------- IGDERP-265 gaps: roster window setting ----------

  @Put('settings')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async upsertSetting(@Body() dto: UpsertShiftSettingDto) {
    return this.svc.upsertSetting(dto);
  }
}
