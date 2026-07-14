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
import { ExpeditionsService } from './expeditions.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateExpeditionDto, UpdateExpeditionDto, ListExpeditionsDto } from './dto';

/**
 * Expeditions Controller
 * Handles expedition management endpoints
 */
@Controller('expeditions')
@UseGuards(JwtAuthGuard)
export class ExpeditionsController {
  constructor(private readonly expeditionsService: ExpeditionsService) {}

  /**
   * List all expeditions
   * GET /api/v1/expeditions
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findAll(@Query() query: ListExpeditionsDto) {
    try {
      return await this.expeditionsService.findAll(query);
    } catch (error) {
      console.error('Error in expeditions.findAll:', error);
      throw error;
    }
  }

  /**
   * Get expedition detail
   * GET /api/v1/expeditions/:id
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findById(@Param('id') id: string) {
    return this.expeditionsService.findById(id);
  }

  /**
   * Create expedition
   * POST /api/v1/expeditions
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createExpeditionDto: CreateExpeditionDto) {
    return this.expeditionsService.create(createExpeditionDto);
  }

  /**
   * Update expedition
   * PUT /api/v1/expeditions/:id
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updateExpeditionDto: UpdateExpeditionDto,
  ) {
    return this.expeditionsService.update(id, updateExpeditionDto);
  }

  /**
   * Delete expedition (soft delete)
   * DELETE /api/v1/expeditions/:id
   * Permissions: CSO, SPV
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.expeditionsService.delete(id);
  }
}
