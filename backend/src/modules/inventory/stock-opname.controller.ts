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
import { StockOpnameService } from './stock-opname.service';
import { StartOpnameDto } from './dto/start-opname.dto';
import { RecordCountDto } from './dto/record-count.dto';

@Controller('inventory/opname')
@UseGuards(JwtAuthGuard)
export class StockOpnameController {
  constructor(private readonly opnameService: StockOpnameService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('HS', 'SPV', 'CSO')
  async startOpname(@Body() dto: StartOpnameDto, @Request() req: any) {
    return this.opnameService.startOpname(dto, req.user.id);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async findAll(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
  ) {
    return this.opnameService.findAll(branchId, status);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('CSO', 'SPV', 'HS', 'ASA', 'SODO', 'CS', 'CR', 'TC', 'AS', 'SMO', 'AR', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async findById(@Param('id') id: string) {
    return this.opnameService.findById(id);
  }

  @Post(':id/items')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO')
  async recordCount(
    @Param('id') id: string,
    @Body() dto: RecordCountDto,
    @Request() req: any,
  ) {
    return this.opnameService.recordCount(id, dto, req.user.id);
  }

  @Post(':id/complete')
  @UseGuards(RolesGuard)
  @Roles('HS', 'ASA', 'SODO')
  async completeOpname(@Param('id') id: string, @Request() req: any) {
    return this.opnameService.completeOpname(id, req.user.id);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('SPV', 'CSO')
  async approveOpname(@Param('id') id: string, @Request() req: any) {
    return this.opnameService.approveOpname(id, req.user.id);
  }
}

