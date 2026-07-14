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
import { UnitsService } from './units.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateUnitDto, UpdateUnitDto, ListUnitsDto } from './dto';

/**
 * Units Controller
 * Handles unit management endpoints
 */
@Controller('units')
@UseGuards(JwtAuthGuard)
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  /**
   * List all units
   * GET /api/v1/units
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findAll(@Query() query: ListUnitsDto) {
    try {
      return await this.unitsService.findAll(query);
    } catch (error) {
      console.error('Error in units.findAll:', error);
      throw error;
    }
  }

  /**
   * Get unit detail
   * GET /api/v1/units/:id
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findById(@Param('id') id: string) {
    return this.unitsService.findById(id);
  }

  /**
   * Create unit
   * POST /api/v1/units
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUnitDto: CreateUnitDto) {
    return this.unitsService.create(createUnitDto);
  }

  /**
   * Update unit
   * PUT /api/v1/units/:id
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updateUnitDto: UpdateUnitDto,
  ) {
    return this.unitsService.update(id, updateUnitDto);
  }

  /**
   * Delete unit (soft delete)
   * DELETE /api/v1/units/:id
   * Permissions: CSO, SPV
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.unitsService.delete(id);
  }
}
