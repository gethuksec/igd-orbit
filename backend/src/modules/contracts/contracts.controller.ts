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
import { ContractsService } from './services/contracts.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { IntakeContractDto } from './dto/intake-contract.dto';

/**
 * Contracts Controller (IGDERP-270)
 * Contract master + stage chain + single HR intake.
 */
const READ_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS', 'HS'];
const WRITE_ROLES = ['SUPERADMIN', 'OWNER', 'HR', 'SPV-HRD', 'MS'];

@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly svc: ContractsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.svc.findAll({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
      type,
      status,
      employeeId,
    });
  }

  // Static routes above ':id' (Express matches in registration order).
  @Get('intake-suggest')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async intakeSuggest(@Query('positionId') positionId: string) {
    return this.svc.intakeSuggest(positionId);
  }

  @Get('employee/:employeeId/chain')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async chainByEmployee(@Param('employeeId') employeeId: string) {
    return this.svc.chainByEmployee(employeeId);
  }

  @Get('employee/:employeeId/tenure-anchor')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async tenureAnchor(@Param('employeeId') employeeId: string) {
    return this.svc.tenureAnchor(employeeId);
  }

  @Post('intake')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  async intake(@Body() dto: IntakeContractDto) {
    return this.svc.intake(dto);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(...READ_ROLES)
  async findById(@Param('id') id: string) {
    return this.svc.findById(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateContractDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  async update(@Param('id') id: string, @Body() dto: UpdateContractDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.svc.remove(id);
  }
}
