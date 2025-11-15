import { Controller, Get, Param, SetMetadata } from '@nestjs/common';
import { ServiceTypesService } from './service-types.service';

// Public decorator for public endpoints
const Public = () => SetMetadata('isPublic', true);

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
}

