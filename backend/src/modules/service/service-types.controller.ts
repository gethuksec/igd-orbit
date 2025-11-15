import { Controller, Get, Param, Post } from '@nestjs/common';
import { ServiceTypesService } from './service-types.service';
import { Public } from '../../shared/decorators/public.decorator';

@Controller('service-types')
export class ServiceTypesController {
  constructor(private readonly serviceTypesService: ServiceTypesService) {}

  /**
   * Get all active service types (public endpoint)
   * GET /api/v1/service-types
   */
  @Get()
  @Public()
  async findAll() {
    return this.serviceTypesService.findAll();
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
}

