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
  ParseUUIDPipe,
} from '@nestjs/common';
import { ServiceCheckpointsService } from './service-checkpoints.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import {
  CreateServiceCheckpointDto,
  UpdateServiceCheckpointDto,
  ListServiceCheckpointsDto,
} from './dto';

/**
 * Service Checkpoints Controller
 * Kelengkapan master data endpoints
 */
@Controller('service-checkpoints')
@UseGuards(JwtAuthGuard)
export class ServiceCheckpointsController {
  constructor(
    private readonly serviceCheckpointsService: ServiceCheckpointsService,
  ) {}

  /**
   * List all checkpoints (paginated)
   * GET /api/v1/service-checkpoints
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'TC', 'CS', 'SODO', 'ASA', 'AR', 'AS', 'SMO', 'CR')
  async findAll(@Query() query: ListServiceCheckpointsDto) {
    return this.serviceCheckpointsService.findAll(query);
  }

  /**
   * Active checkpoints for service forms (must be before :id route)
   * GET /api/v1/service-checkpoints/active
   */
  @Get('active')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'TC', 'CS', 'SODO', 'ASA', 'AR', 'AS', 'SMO', 'CR')
  async findActive() {
    return this.serviceCheckpointsService.findActive();
  }

  /**
   * Get checkpoint detail
   * GET /api/v1/service-checkpoints/:id
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'TC', 'CS', 'SODO', 'ASA', 'AR', 'AS', 'SMO', 'CR')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceCheckpointsService.findById(id);
  }

  /**
   * Create checkpoint
   * POST /api/v1/service-checkpoints
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'MGR', 'CSO', 'SPV')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateServiceCheckpointDto) {
    return this.serviceCheckpointsService.create(dto);
  }

  /**
   * Update checkpoint
   * PUT /api/v1/service-checkpoints/:id
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'MGR', 'CSO', 'SPV')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceCheckpointDto,
  ) {
    return this.serviceCheckpointsService.update(id, dto);
  }

  /**
   * Delete checkpoint
   * DELETE /api/v1/service-checkpoints/:id
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'MGR', 'CSO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.serviceCheckpointsService.delete(id);
  }
}
