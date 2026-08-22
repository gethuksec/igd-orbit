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
import { CustomerTypesService } from './customer-types.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateCustomerTypeDto, UpdateCustomerTypeDto, ListCustomerTypesDto } from './dto';

/**
 * Sales Types Controller
 * Handles sales type management endpoints
 */
@Controller('customer-types')
@UseGuards(JwtAuthGuard)
export class CustomerTypesController {
  constructor(private readonly customerTypesService: CustomerTypesService) {}

  /**
   * List all sales types
   * GET /api/v1/customer-types
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findAll(@Query() query: ListCustomerTypesDto) {
    try {
      return await this.customerTypesService.findAll(query);
    } catch (error) {
      console.error('Error in customerTypes.findAll:', error);
      throw error;
    }
  }

  /**
   * Get sales type detail
   * GET /api/v1/customer-types/:id
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findById(@Param('id') id: string) {
    return this.customerTypesService.findById(id);
  }

  /**
   * Create sales type
   * POST /api/v1/customer-types
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCustomerTypeDto: CreateCustomerTypeDto) {
    return this.customerTypesService.create(createCustomerTypeDto);
  }

  /**
   * Update sales type
   * PUT /api/v1/customer-types/:id
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updateCustomerTypeDto: UpdateCustomerTypeDto,
  ) {
    return this.customerTypesService.update(id, updateCustomerTypeDto);
  }

  /**
   * Delete sales type (soft delete)
   * DELETE /api/v1/customer-types/:id
   * Permissions: CSO, SPV
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.customerTypesService.delete(id);
  }
}
