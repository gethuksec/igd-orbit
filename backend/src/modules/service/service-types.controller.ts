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
import { ServiceTypesService } from './service-types.service';
import { Public } from '../../shared/decorators/public.decorator';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateServiceTypeDto } from './dto/create-service-type.dto';
import { UpdateServiceTypeDto } from './dto/update-service-type.dto';

@Controller('service-types')
export class ServiceTypesController {
  constructor(private readonly serviceTypesService: ServiceTypesService) {}

  /**
   * Get all active service types (public endpoint)
   * GET /api/v1/service-types
   */
  @Get()
  @Public()
  async findAll(@Query('includeInactive') includeInactive?: string) {
    return this.serviceTypesService.findAll(includeInactive === 'true');
  }

  /**
   * Get service type by ID (public endpoint)
   * GET /api/v1/service-types/:id
   */
  @Get(':id')
  @Public()
  async findById(@Param('id') id: string) {
    return this.serviceTypesService.findById(id);
  }

  /**
   * Seed service types (development only)
   * POST /api/v1/service-types/seed
   */
  @Public()
  @Post('seed')
  async seed() {
    return this.serviceTypesService.seedServiceTypes();
  }

  /**
   * Create service type
   * POST /api/v1/service-types
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createServiceTypeDto: CreateServiceTypeDto) {
    return this.serviceTypesService.create(createServiceTypeDto);
  }

  /**
   * Update service type
   * PUT /api/v1/service-types/:id
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS')
  async update(
    @Param('id') id: string,
    @Body() updateServiceTypeDto: UpdateServiceTypeDto,
  ) {
    return this.serviceTypesService.update(id, updateServiceTypeDto);
  }

  /**
   * Delete service type (soft delete)
   * DELETE /api/v1/service-types/:id
   * Permissions: OWNER, CFO, MGR, CSO, SPV
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.serviceTypesService.delete(id);
  }
}

