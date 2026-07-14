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
import { SizesService } from './sizes.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateSizeDto, UpdateSizeDto, ListSizesDto } from './dto';

/**
 * Sizes Controller
 * Handles size management endpoints
 */
@Controller('sizes')
@UseGuards(JwtAuthGuard)
export class SizesController {
  constructor(private readonly sizesService: SizesService) {}

  /**
   * List all sizes
   * GET /api/v1/sizes
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findAll(@Query() query: ListSizesDto) {
    try {
      return await this.sizesService.findAll(query);
    } catch (error) {
      console.error('Error in sizes.findAll:', error);
      throw error;
    }
  }

  /**
   * Get size detail
   * GET /api/v1/sizes/:id
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findById(@Param('id') id: string) {
    return this.sizesService.findById(id);
  }

  /**
   * Create size
   * POST /api/v1/sizes
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createSizeDto: CreateSizeDto) {
    return this.sizesService.create(createSizeDto);
  }

  /**
   * Update size
   * PUT /api/v1/sizes/:id
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updateSizeDto: UpdateSizeDto,
  ) {
    return this.sizesService.update(id, updateSizeDto);
  }

  /**
   * Delete size (soft delete)
   * DELETE /api/v1/sizes/:id
   * Permissions: CSO, SPV
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.sizesService.delete(id);
  }
}
