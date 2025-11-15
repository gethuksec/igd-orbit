import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { StockTransferService } from './stock-transfer.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { ReceiveTransferDto } from './dto/receive-transfer.dto';

@Controller('inventory/transfers')
@UseGuards(JwtAuthGuard)
export class StockTransferController {
  constructor(private readonly transferService: StockTransferService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO')
  async createTransfer(@Body() dto: CreateTransferDto, @Request() req: any) {
    return this.transferService.createTransfer(dto, req.user.id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async findAll(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    return this.transferService.findAll(branchId, status);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async findById(@Param('id') id: string) {
    return this.transferService.findById(id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('SPV', 'CSO')
  async approveTransfer(@Param('id') id: string, @Request() req: any) {
    return this.transferService.approveTransfer(id, req.user.id);
  }

  @Post(':id/send')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO')
  async sendTransfer(@Param('id') id: string, @Request() req: any) {
    return this.transferService.sendTransfer(id, req.user.id);
  }

  @Post(':id/receive')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO')
  async receiveTransfer(
    @Param('id') id: string,
    @Body() dto: ReceiveTransferDto,
    @Request() req: any,
  ) {
    return this.transferService.receiveTransfer(id, dto, req.user.id);
  }

  @Post(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO', 'SPV', 'CSO')
  async cancelTransfer(@Param('id') id: string, @Request() req: any) {
    return this.transferService.cancelTransfer(id, req.user.id);
  }
}

