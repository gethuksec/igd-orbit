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
import { GradesService } from './services/grades.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateGradeDto } from './dto/create-grade.dto';
import { UpdateGradeDto } from './dto/update-grade.dto';

/**
 * Grades Controller (IGDERP-277)
 * Staff-only tier ladder G1-G6.
 */
const READ_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS', 'HS'];
const WRITE_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS'];

@Controller('grades')
@UseGuards(JwtAuthGuard)
export class GradesController {
  constructor(private readonly svc: GradesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    if (page || limit) {
      return this.svc.findAllPaginated(page ? parseInt(page) : 1, limit ? parseInt(limit) : 20, search);
    }
    return this.svc.findAll();
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
  async create(@Body() dto: CreateGradeDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async update(@Param('id') id: string, @Body() dto: UpdateGradeDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.svc.remove(id);
  }
}
