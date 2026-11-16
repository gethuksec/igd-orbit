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
import { WorkingLocationsService } from './services/working-locations.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateWorkingLocationDto } from './dto/create-working-location.dto';
import { UpdateWorkingLocationDto } from './dto/update-working-location.dto';

/**
 * Working Locations Controller (IGDERP-270)
 * Manual CRUD for HQ-like work sites. Readable by HR roles + HS (clock-in
 * validation reads these); writes stay with HR admins.
 */
const READ_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS', 'HS'];
const WRITE_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS'];

@Controller('working-locations')
@UseGuards(JwtAuthGuard)
export class WorkingLocationsController {
  constructor(private readonly svc: WorkingLocationsService) {}

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
  async create(@Body() dto: CreateWorkingLocationDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async update(@Param('id') id: string, @Body() dto: UpdateWorkingLocationDto) {
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
