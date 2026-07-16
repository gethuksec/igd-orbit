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
import { PaymentTermsService } from './payment-terms.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreatePaymentTermDto, UpdatePaymentTermDto, ListPaymentTermsDto } from './dto';

/**
 * Payment Terms Controller
 * Handles payment term master data endpoints
 */
@Controller('payment-terms')
@UseGuards(JwtAuthGuard)
export class PaymentTermsController {
  constructor(private readonly paymentTermsService: PaymentTermsService) {}

  /**
   * List all payment terms
   * GET /api/v1/payment-terms
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findAll(@Query() query: ListPaymentTermsDto) {
    try {
      return await this.paymentTermsService.findAll(query);
    } catch (error) {
      console.error('Error in paymentTerms.findAll:', error);
      throw error;
    }
  }

  /**
   * Get payment term detail
   * GET /api/v1/payment-terms/:id
   * Permissions: OWNER, CFO, MGR, CSO, CMO, SPV, HS, ASA
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async findById(@Param('id') id: string) {
    return this.paymentTermsService.findById(id);
  }

  /**
   * Create payment term
   * POST /api/v1/payment-terms
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createPaymentTermDto: CreatePaymentTermDto) {
    return this.paymentTermsService.create(createPaymentTermDto);
  }

  /**
   * Update payment term
   * PUT /api/v1/payment-terms/:id
   * Permissions: CSO, CMO, SPV, HS, ASA
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'CMO', 'SPV', 'HS', 'ASA')
  async update(
    @Param('id') id: string,
    @Body() updatePaymentTermDto: UpdatePaymentTermDto,
  ) {
    return this.paymentTermsService.update(id, updatePaymentTermDto);
  }

  /**
   * Delete payment term (soft delete)
   * DELETE /api/v1/payment-terms/:id
   * Permissions: CSO, SPV
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string) {
    await this.paymentTermsService.delete(id);
  }
}
