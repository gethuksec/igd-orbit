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
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { CustomersService } from './customers.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  ListCustomersDto,
  BlacklistCustomerDto,
  MergeCustomersDto,
} from './dto';

/**
 * Customers Controller
 * Handles customer management endpoints
 */
@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * List customers with filters and search
   * GET /api/v1/customers
   * Permissions: All authenticated users
   */
  @Get()
  async findAll(@Query() query: ListCustomersDto) {
    try {
      return await this.customersService.findAll(query);
    } catch (error) {
      console.error('Error in customers.findAll:', error);
      throw error;
    }
  }

  /**
   * Get customer detail with statistics
   * GET /api/v1/customers/:id
   * Permissions: All authenticated users
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.customersService.findById(id);
  }

  /**
   * Create new customer
   * POST /api/v1/customers
   * Permissions: CMO, SPV, HS, CS, ASA, CR
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CMO', 'SPV', 'HS', 'CS', 'ASA', 'CR')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createCustomerDto: CreateCustomerDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.customersService.create(createCustomerDto, req.user.id);
  }

  /**
   * Update customer info
   * PUT /api/v1/customers/:id
   * Permissions: CMO, SPV, HS, CS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CMO', 'SPV', 'HS', 'CS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.customersService.update(id, updateCustomerDto, req.user.id);
  }

  /**
   * Soft delete customer
   * DELETE /api/v1/customers/:id
   * Permissions: CMO, SPV (with approval)
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('CMO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    await this.customersService.softDelete(id, req.user.id);
  }

  /**
   * Get purchase statistics
   * GET /api/v1/customers/:id/stats
   * Permissions: All authenticated users
   */
  @Get(':id/stats')
  async getStatistics(@Param('id') id: string) {
    return this.customersService.getStatistics(id);
  }

  /**
   * Get transaction history
   * GET /api/v1/customers/:id/transactions
   * Permissions: All authenticated users
   */
  @Get(':id/transactions')
  async getTransactionHistory(@Param('id') id: string, @Query() query: any) {
    return this.customersService.getTransactionHistory(id, query);
  }

  /**
   * Add customer to blacklist
   * POST /api/v1/customers/:id/blacklist
   * Permissions: CMO, SPV, HS
   */
  @Post(':id/blacklist')
  @UseGuards(RolesGuard)
  @Roles('CMO', 'SPV', 'HS')
  @HttpCode(HttpStatus.OK)
  async blacklist(
    @Param('id') id: string,
    @Body() blacklistDto: BlacklistCustomerDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    await this.customersService.blacklistCustomer(id, blacklistDto, req.user.id);
    return { message: 'Customer blacklisted successfully' };
  }

  /**
   * Remove customer from blacklist
   * DELETE /api/v1/customers/:id/blacklist
   * Permissions: CMO, SPV, HS
   */
  @Delete(':id/blacklist')
  @UseGuards(RolesGuard)
  @Roles('CMO', 'SPV', 'HS')
  @HttpCode(HttpStatus.OK)
  async removeBlacklist(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    await this.customersService.removeBlacklist(id, req.user.id);
    return { message: 'Customer removed from blacklist successfully' };
  }

  /**
   * Bulk import customers
   * POST /api/v1/customers/import
   * Permissions: CMO, SPV, HS, ASA
   * TODO: Implement CSV parsing and bulk import
   */
  @Post('import')
  @UseGuards(RolesGuard)
  @Roles('CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.OK)
  async import(@Request() _req: ExpressRequest & { user: any }) {
    return {
      message: 'Import functionality will be implemented in next phase',
      note: 'This endpoint accepts CSV file upload for bulk customer import',
    };
  }

  /**
   * Export filtered customer data
   * GET /api/v1/customers/export
   * Permissions: CMO, CFO, SPV, HS
   * TODO: Implement export functionality
   */
  @Get('export')
  @UseGuards(RolesGuard)
  @Roles('CMO', 'CFO', 'SPV', 'HS')
  async export(@Query() _query: ListCustomersDto) {
    return {
      message: 'Export functionality will be implemented in next phase',
      note: 'This endpoint will export customers to CSV/Excel format based on current filters',
    };
  }

  /**
   * Merge duplicate customers
   * POST /api/v1/customers/merge
   * Permissions: CMO, SUPERADMIN only
   */
  @Post('merge')
  @UseGuards(RolesGuard)
  @Roles('CMO', 'SUPERADMIN')
  @HttpCode(HttpStatus.OK)
  async merge(
    @Body() mergeDto: MergeCustomersDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    await this.customersService.mergeDuplicates(mergeDto, req.user.id);
    return { message: 'Customers merged successfully' };
  }
}

