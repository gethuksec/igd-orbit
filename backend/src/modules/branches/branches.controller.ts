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
import { BranchesService } from './branches.service';
import { Public } from '../../shared/decorators/public.decorator';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  /**
   * Get all active branches (public endpoint for dropdown)
   * GET /api/v1/branches
   */
  @Get()
  @Public()
  async findAllPublic() {
    const result = await this.branchesService.findAll(1, 1000);
    return result.data;
  }

  /**
   * Get all branches with pagination (admin endpoint)
   * GET /api/v1/branches/list
   * Permissions: OWNER, CFO, MGR
   */
  @Get('list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 20;
    const includeInactiveBool = includeInactive === 'true';
    return this.branchesService.findAll(pageNum, limitNum, search, includeInactiveBool);
  }

  /**
   * Get branch by ID (public endpoint)
   * GET /api/v1/branches/:id
   */
  @Get(':id')
  @Public()
  async findById(@Param('id') id: string) {
    return this.branchesService.findById(id);
  }

  /**
   * Get detailed statistics for a branch
   * GET /api/v1/branches/:id/stats
   * Permissions: OWNER, CFO, MGR
   */
  @Get(':id/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR')
  async getDetailedStats(@Param('id') id: string) {
    return this.branchesService.getDetailedStats(id);
  }

  /**
   * Get users with HS role for branch assignment
   * GET /api/v1/branches/hs-users
   * Permissions: OWNER, CFO, MGR
   */
  @Get('hs-users/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR')
  async getHSUsers() {
    return this.branchesService.getHSUsers();
  }

  /**
   * Create branch
   * POST /api/v1/branches
   * Permissions: OWNER, CFO, MGR
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createBranchDto: CreateBranchDto) {
    return this.branchesService.create(createBranchDto);
  }

  /**
   * Update branch
   * PUT /api/v1/branches/:id
   * Permissions: OWNER, CFO, MGR
   */
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR')
  async update(
    @Param('id') id: string,
    @Body() updateBranchDto: UpdateBranchDto,
  ) {
    return this.branchesService.update(id, updateBranchDto);
  }

  /**
   * Delete branch (soft delete)
   * DELETE /api/v1/branches/:id
   * Permissions: OWNER, CFO
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('OWNER', 'CFO')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.branchesService.delete(id);
  }
}

