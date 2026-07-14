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
import { ColorsService } from './colors.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateColorDto, UpdateColorDto, ListColorsDto } from './dto';

/**
 * Colors Controller
 * Handles color management endpoints
 */
@Controller('colors')
@UseGuards(JwtAuthGuard)
export class ColorsController {
  constructor(private readonly colorsService: ColorsService) {}

  /**
   * List all colors
   * GET /api/v1/colors
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findAll(@Query() query: ListColorsDto) {
    try {
      return await this.colorsService.findAll(query);
    } catch (error) {
      console.error('Error in colors.findAll:', error);
      throw error;
    }
  }

  /**
   * Get color detail
   * GET /api/v1/colors/:id
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findById(@Param('id') id: string) {
    return this.colorsService.findById(id);
  }

  /**
   * Create color
   * POST /api/v1/colors
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createColorDto: CreateColorDto) {
    return this.colorsService.create(createColorDto);
  }

  /**
   * Update color
   * PUT /api/v1/colors/:id
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updateColorDto: UpdateColorDto,
  ) {
    return this.colorsService.update(id, updateColorDto);
  }

  /**
   * Delete color (soft delete)
   * DELETE /api/v1/colors/:id
   * Permissions: CSO, SPV
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.colorsService.delete(id);
  }
}
