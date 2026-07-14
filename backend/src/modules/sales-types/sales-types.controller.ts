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
import { SalesTypesService } from './sales-types.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateSalesTypeDto, UpdateSalesTypeDto, ListSalesTypesDto } from './dto';

/**
 * Sales Types Controller
 * Handles sales type management endpoints
 */
@Controller('sales-types')
@UseGuards(JwtAuthGuard)
export class SalesTypesController {
  constructor(private readonly salesTypesService: SalesTypesService) {}

  /**
   * List all sales types
   * GET /api/v1/sales-types
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findAll(@Query() query: ListSalesTypesDto) {
    try {
      return await this.salesTypesService.findAll(query);
    } catch (error) {
      console.error('Error in salesTypes.findAll:', error);
      throw error;
    }
  }

  /**
   * Get sales type detail
   * GET /api/v1/sales-types/:id
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findById(@Param('id') id: string) {
    return this.salesTypesService.findById(id);
  }

  /**
   * Create sales type
   * POST /api/v1/sales-types
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSalesTypeDto: CreateSalesTypeDto) {
    return this.salesTypesService.create(createSalesTypeDto);
  }

  /**
   * Update sales type
   * PUT /api/v1/sales-types/:id
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updateSalesTypeDto: UpdateSalesTypeDto,
  ) {
    return this.salesTypesService.update(id, updateSalesTypeDto);
  }

  /**
   * Delete sales type (soft delete)
   * DELETE /api/v1/sales-types/:id
   * Permissions: CSO, SPV
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.salesTypesService.delete(id);
  }
}
