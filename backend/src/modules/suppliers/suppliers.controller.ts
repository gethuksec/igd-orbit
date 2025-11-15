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
import { CustomersService } from '../customers/customers.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  ListCustomersDto,
} from '../customers/dto';
import { NotFoundException } from '@nestjs/common';

/**
 * Suppliers Controller
 * Handles supplier management endpoints
 * Note: Suppliers are stored as customers with customerType='wholesale'
 */
@Controller('suppliers')
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * List suppliers with filters and search
   * GET /api/v1/suppliers
   * Permissions: All authenticated users
   */
  @Get()
  async findAll(@Query() query: ListCustomersDto) {
    // Force filter to only show wholesale customers (suppliers)
    const supplierQuery = {
      ...query,
      'filter[type]': ['wholesale'],
    };
    return this.customersService.findAll(supplierQuery as ListCustomersDto);
  }

  /**
   * Get supplier detail
   * GET /api/v1/suppliers/:id
   * Permissions: All authenticated users
   */
  @Get(':id')
  async findById(@Param('id') id: string) {
    try {
      const customer = await this.customersService.findById(id);
      // Verify it's a supplier
      if (customer.customerType !== 'wholesale') {
        throw new NotFoundException('Supplier not found');
      }
      return customer;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException('Supplier not found');
    }
  }

  /**
   * Create new supplier
   * POST /api/v1/suppliers
   * Permissions: CMO, SPV, HS, CS, ASA, CR
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CMO', 'SPV', 'HS', 'CS', 'ASA', 'CR')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createSupplierDto: CreateCustomerDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    // Force customerType to wholesale
    const supplierData = {
      ...createSupplierDto,
      customerType: 'wholesale' as const,
    };
    return this.customersService.create(supplierData, req.user.id);
  }

  /**
   * Update supplier info
   * PUT /api/v1/suppliers/:id
   * Permissions: CMO, SPV, HS, CS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CMO', 'SPV', 'HS', 'CS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateCustomerDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    // Ensure customerType remains wholesale
    const supplierData = {
      ...updateSupplierDto,
      customerType: 'wholesale' as const,
    };
    return this.customersService.update(id, supplierData, req.user.id);
  }

  /**
   * Delete supplier (soft delete)
   * DELETE /api/v1/suppliers/:id
   * Permissions: CMO, SPV
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
}

