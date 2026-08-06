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
import { WarehousesService } from './warehouses.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateWarehouseDto, UpdateWarehouseDto, ListWarehousesDto } from './dto';

/**
 * Warehouses Controller
 * Handles warehouse management endpoints (D2)
 */
@Controller('warehouses')
@UseGuards(JwtAuthGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  /**
   * List all warehouses
   * GET /api/v1/warehouses
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA, SODO
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA', 'SODO')
  async findAll(@Query() query: ListWarehousesDto) {
    try {
      return await this.warehousesService.findAll(query);
    } catch (error) {
      console.error('Error in warehouses.findAll:', error);
      throw error;
    }
  }

  /**
   * Get warehouse detail
   * GET /api/v1/warehouses/:id
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA, SODO
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA', 'SODO')
  async findById(@Param('id') id: string) {
    return this.warehousesService.findById(id);
  }

  /**
   * Create warehouse
   * POST /api/v1/warehouses
   * Permissions: OWNER, CSO, CMO, SPV, HS, ASA
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createWarehouseDto: CreateWarehouseDto) {
    return this.warehousesService.create(createWarehouseDto);
  }

  /**
   * Update warehouse
   * PUT /api/v1/warehouses/:id
   * Permissions: OWNER, CSO, CMO, SPV, HS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
  ) {
    return this.warehousesService.update(id, updateWarehouseDto);
  }

  /**
   * Delete warehouse (soft delete)
   * DELETE /api/v1/warehouses/:id
   * Permissions: OWNER, CSO, SPV
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CSO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.warehousesService.delete(id);
  }
}
