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
import { BrandsService } from './brands.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateBrandDto, UpdateBrandDto, ListBrandsDto } from './dto';

/**
 * Brands Controller
 * Handles brand management endpoints
 */
@Controller('brands')
@UseGuards(JwtAuthGuard)
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  /**
   * List all brands
   * GET /api/v1/brands
   * Permissions: All authenticated users
   */
  @Get()
  async findAll(@Query() query: ListBrandsDto) {
    return this.brandsService.findAll(query);
  }

  /**
   * Get brand detail
   * GET /api/v1/brands/:id
   * Permissions: All authenticated users
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.brandsService.findById(id);
  }

  /**
   * Create brand
   * POST /api/v1/brands
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createBrandDto: CreateBrandDto) {
    return this.brandsService.create(createBrandDto);
  }

  /**
   * Update brand
   * PUT /api/v1/brands/:id
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updateBrandDto: UpdateBrandDto,
  ) {
    return this.brandsService.update(id, updateBrandDto);
  }

  /**
   * Delete brand (soft delete)
   * DELETE /api/v1/brands/:id
   * Permissions: CSO, SPV
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.brandsService.delete(id);
  }
}

