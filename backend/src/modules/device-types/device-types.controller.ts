import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { DeviceTypesService } from './device-types.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import {
  CreateDeviceTypeDto,
  UpdateDeviceTypeDto,
  ListDeviceTypesDto,
} from './dto';

/**
 * Device Types Controller (IGDERP-169)
 * Master data for Smart Repair device types.
 */
@Controller('device-types')
@UseGuards(JwtAuthGuard)
export class DeviceTypesController {
  constructor(private readonly deviceTypesService: DeviceTypesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'TC', 'CS', 'SODO', 'ASA', 'AR', 'AS', 'SMO', 'CR')
  async findAll(@Query() query: ListDeviceTypesDto) {
    return this.deviceTypesService.findAll(query);
  }

  /** Active device types for intake dropdowns (must be before :id route) */
  @Get('active')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'TC', 'CS', 'SODO', 'ASA', 'AR', 'AS', 'SMO', 'CR')
  async findActive() {
    return this.deviceTypesService.findActive();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'TC', 'CS', 'SODO', 'ASA', 'AR', 'AS', 'SMO', 'CR')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.deviceTypesService.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'MGR', 'HS', 'SPV')
  async create(@Body() dto: CreateDeviceTypeDto) {
    return this.deviceTypesService.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'MGR', 'HS', 'SPV')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeviceTypeDto) {
    return this.deviceTypesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'MGR')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.deviceTypesService.delete(id);
    return { id, deleted: true };
  }
}
