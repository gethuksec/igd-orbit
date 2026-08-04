import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { PosService } from './pos.service';
import { JwtAuthGuard } from '../../shared/guards';
import { CreatePosTransactionDto } from './dto/create-pos-transaction.dto';

@Controller('pos')
@UseGuards(JwtAuthGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  // ─── Transaction endpoints ───

  @Post('transactions')
  @HttpCode(HttpStatus.CREATED)
  async createTransaction(
    @Body() dto: CreatePosTransactionDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    // T21: cashierId comes from the JWT user, not from the payload
    return this.posService.createTransaction(dto, req.user.id);
  }

  // ─── Supporting list endpoints ───

  @Get('products')
  async searchProducts(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.posService.searchProducts(query, limit ? parseInt(limit) : 20);
  }

  @Get('customers')
  async searchCustomers(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.posService.searchCustomers(query, limit ? parseInt(limit) : 20);
  }

  @Get('warehouses')
  async listWarehouses() {
    return this.posService.listWarehouses();
  }

  @Get('sales-persons')
  async listSalesPersons() {
    return this.posService.listSalesPersons();
  }

  @Get('payment-terms')
  async listPaymentTerms() {
    return this.posService.listPaymentTerms();
  }

  @Get('sales-types')
  async listSalesTypes() {
    return this.posService.listSalesTypes();
  }

  @Get('branches')
  async listBranches() {
    return this.posService.listBranches();
  }
}
