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
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { ConfirmCustomerImportDto } from './dto/confirm-customer-import.dto';

/**
 * Customers Controller
 * Handles customer management endpoints
 */
@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  /**
   * Get overall customer statistics
   * GET /api/v1/customers/statistics
   * Permissions: OWNER, CFO, MGR, CMO, SPV, HS, CS, ASA, CR
   */
  @Get('statistics')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CMO', 'SPV', 'HS', 'CS', 'ASA', 'CR')
  async getOverallStatistics() {
    return await this.customersService.getOverallStatistics();
  }

  /**
   * List customers with filters and search
   * GET /api/v1/customers
   * Permissions: OWNER, CFO, MGR, CMO, SPV, HS, CS, ASA, CR
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CMO', 'SPV', 'HS', 'CS', 'ASA', 'CR')
  async findAll(@Query() query: ListCustomersDto) {
    try {
      return await this.customersService.findAll(query);
    } catch (error) {
      console.error('Error in customers.findAll:', error);
      throw error;
    }
  }

  /**
   * Export filtered customer data
   * GET /api/v1/customers/export
   * Permissions: OWNER, CMO, CFO, SPV, HS
   * NOTE: Must be before @Get(':id') to avoid route conflict
   */
  @Get('export')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CMO', 'CFO', 'SPV', 'HS')
  async export(@Query() query: ListCustomersDto, @Res() res: Response): Promise<void> {
    const csv = await this.customersService.exportToCSV(query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="customers-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8 support
  }

  /**
   * List all active customer tiers
   * GET /api/v1/customers/tiers
   * Permissions: All authenticated users
   */
  @Get('tiers')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CMO', 'SPV', 'HS', 'CS', 'ASA', 'CR')
  async getTiers() {
    return this.customersService.getActiveTiers();
  }

  /**
   * Download the customer XLSX import template (user template, 8 cols).
   * GET /api/v1/customers/import/template
   * Permissions: OWNER, CMO, SPV, HS, ASA
   * NOTE: Must be before @Get(':id') to avoid route conflict
   */
  @Get('import/template')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CMO', 'SPV', 'HS', 'ASA')
  async importTemplate(@Res() res: Response): Promise<void> {
    const buffer = await this.customersService.buildCustomerImportTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="template-import-pelanggan.xlsx"',
    );
    res.send(buffer);
  }

  /**
   * Preview a customer XLSX import (read-only validation).
   * POST /api/v1/customers/import/preview
   * Permissions: OWNER, CMO, SPV, HS, ASA
   */
  @Post('import/preview')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CMO', 'SPV', 'HS', 'ASA')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async importPreview(@UploadedFile() file: any) {
    if (!file?.buffer) {
      throw new BadRequestException('File Excel wajib diunggah');
    }
    return this.customersService.previewCustomerImport(file.buffer);
  }

  /**
   * Confirm a previewed customer XLSX import.
   * POST /api/v1/customers/import/confirm
   * Permissions: OWNER, CMO, SPV, HS, ASA
   */
  @Post('import/confirm')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.OK)
  async importConfirm(
    @Body() dto: ConfirmCustomerImportDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.customersService.confirmCustomerImport(dto, req.user.id);
  }

  /**
   * Export all active non-deleted customers as XLSX (round-trip import format).
   * GET /api/v1/customers/import/export
   * Permissions: OWNER, CMO, SPV, HS, ASA
   * NOTE: Must be before @Get(':id') to avoid route conflict
   */
  @Get('import/export')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CMO', 'SPV', 'HS', 'ASA')
  async importExport(@Res() res: Response): Promise<void> {
    const buffer = await this.customersService.exportCustomersToXlsx();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ekspor-pelanggan.xlsx"',
    );
    res.send(buffer);
  }

  /**
   * Get customer detail with statistics
   * GET /api/v1/customers/:id
   * Permissions: OWNER, CFO, MGR, CMO, SPV, HS, CS, ASA, CR
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CMO', 'SPV', 'HS', 'CS', 'ASA', 'CR')
  async findById(@Param('id') id: string) {
    return this.customersService.findById(id);
  }

  /**
   * Create new customer
   * POST /api/v1/customers
   * Permissions: OWNER, CMO, SPV, HS, CS, ASA, CR
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CMO', 'SPV', 'HS', 'CS', 'ASA', 'CR')
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
   * Permissions: OWNER, CMO, SPV, HS, CS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CMO', 'SPV', 'HS', 'CS', 'ASA')
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
   * Permissions: OWNER, CFO, MGR, CMO, SPV, HS, CS, ASA, CR
   */
  @Get(':id/stats')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CMO', 'SPV', 'HS', 'CS', 'ASA', 'CR')
  async getStatistics(@Param('id') id: string) {
    return this.customersService.getStatistics(id);
  }

  /**
   * Get transaction history
   * GET /api/v1/customers/:id/transactions
   * Permissions: OWNER, CFO, MGR, CMO, SPV, HS, CS, ASA, CR
   */
  @Get(':id/transactions')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CMO', 'SPV', 'HS', 'CS', 'ASA', 'CR')
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
   * Permissions: OWNER, CMO, SPV, HS, ASA
   */
  @Post('import')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CMO', 'SPV', 'HS', 'ASA')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  async import(
    @UploadedFile() file: any,
    @Request() req: ExpressRequest & { user: any },
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    return this.customersService.importFromCSV(file.buffer.toString('utf-8'), req.user.id);
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

