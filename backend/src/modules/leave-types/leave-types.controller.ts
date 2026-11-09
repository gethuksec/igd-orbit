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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LeaveTypesService } from './leave-types.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto, ListLeaveTypesDto } from './dto';

/**
 * Leave Types Controller (IGDERP-261)
 * HR master-data endpoints
 */
@Controller('leave-types')
@UseGuards(JwtAuthGuard)
export class LeaveTypesController {
  constructor(private readonly svc: LeaveTypesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'CHR', 'HS', 'SPV')
  async findAll(@Query() query: ListLeaveTypesDto) {
    try {
      return await this.svc.findAll(query);
    } catch (error) {
      console.error('Error in leaveType.findAll:', error);
      throw error;
    }
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'CHR', 'HS', 'SPV')
  async findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'CHR')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateLeaveTypeDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'CHR')
  async update(@Param('id') id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'CHR')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.svc.delete(id);
  }
}
