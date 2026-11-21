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
import { ShiftAssignmentsService } from './shift-assignments.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import {
  CreateShiftAssignmentDto,
  UpdateShiftAssignmentDto,
  ListShiftAssignmentsDto,
} from './dto';

const READ_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS', 'HS', 'CHR'];
const WRITE_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'CHR'];

/**
 * Shift Assignments Controller — employee scheduling endpoints
 */
@Controller('shift-assignments')
@UseGuards(JwtAuthGuard)
export class ShiftAssignmentsController {
  constructor(private readonly svc: ShiftAssignmentsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async findAll(@Query() query: ListShiftAssignmentsDto) {
    try {
      return await this.svc.findAll(query);
    } catch (error) {
      console.error('Error in shiftAssignment.findAll:', error);
      throw error;
    }
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
  async create(@Body() dto: CreateShiftAssignmentDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async update(@Param('id') id: string, @Body() dto: UpdateShiftAssignmentDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.svc.delete(id);
  }
}
