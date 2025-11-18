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
import { CategoriesService } from './categories.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';

/**
 * Categories Controller
 * Handles category management endpoints
 */
@Controller('categories')
@UseGuards(JwtAuthGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * List categories in tree structure
   * GET /api/v1/categories?tree=true
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findAll(@Query('tree') tree?: string, @Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string, @Query('filter[isActive]') isActive?: string) {
    try {
      // If tree=true, return tree structure
      if (tree === 'true') {
        return await this.categoriesService.findAll();
      }
      
      // Otherwise return paginated list
      const pageNum = page ? parseInt(page) : 1;
      const limitNum = limit ? parseInt(limit) : 20;
      const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
      
      return await this.categoriesService.findAllPaginated(pageNum, limitNum, search, isActiveBool);
    } catch (error) {
      console.error('Error in categories.findAll:', error);
      throw error;
    }
  }

  /**
   * Get category tree (alias for findAll)
   * GET /api/v1/categories/tree
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get('tree')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findTree() {
    return this.categoriesService.findTree();
  }

  /**
   * Get category with subcategories
   * GET /api/v1/categories/:id
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findById(@Param('id') id: string) {
    return this.categoriesService.findById(id);
  }

  /**
   * Create category
   * POST /api/v1/categories
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  /**
   * Update category
   * PUT /api/v1/categories/:id
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  /**
   * Delete category
   * DELETE /api/v1/categories/:id
   * Permissions: CSO, SPV
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.categoriesService.delete(id);
  }

  /**
   * Reorder categories
   * POST /api/v1/categories/reorder
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Post('reorder')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.OK)
  async reorder(@Body() body: { orders: Array<{ id: string; sortOrder: number }> }) {
    await this.categoriesService.reorder(body.orders);
    return { message: 'Categories reordered successfully' };
  }
}

