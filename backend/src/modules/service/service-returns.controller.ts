import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ServiceReturnsService } from './service-returns.service';
import { CreateServiceReturnDto } from './dto/create-service-return.dto';
import { UpdateServiceReturnDto } from './dto/update-service-return.dto';
import { ApproveServiceReturnDto, RejectServiceReturnDto } from './dto/approve-service-return.dto';
import { CreateReServiceDto } from './dto/create-re-service.dto';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';

@Controller('service-returns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceReturnsController {
  constructor(private readonly serviceReturnsService: ServiceReturnsService) {}

  /**
   * Create service return/complaint
   * POST /api/v1/service-returns
   */
  @Post()
  @Roles('CS', 'CR', 'HS', 'SPV', 'CMO', 'CSO')
  async create(@Body() dto: CreateServiceReturnDto, @Request() req: any) {
    return this.serviceReturnsService.create(dto, req.user.id);
  }

  /**
   * List all service returns
   * GET /api/v1/service-returns
   */
  @Get()
  @Roles('CS', 'CR', 'HS', 'SPV', 'CMO', 'CSO', 'OWNER', 'CFO', 'MANAGER')
  async findAll(@Query() query: any) {
    return this.serviceReturnsService.findAll(query);
  }

  /**
   * Get service return by ID
   * GET /api/v1/service-returns/:id
   */
  @Get(':id')
  @Roles('CS', 'CR', 'HS', 'SPV', 'CMO', 'CSO', 'OWNER', 'CFO', 'MANAGER')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.serviceReturnsService.findById(id);
  }

  /**
   * Update service return
   * PUT /api/v1/service-returns/:id
   */
  @Put(':id')
  @Roles('CS', 'CR', 'HS', 'SPV', 'CMO', 'CSO')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceReturnDto,
    @Request() req: any,
  ) {
    return this.serviceReturnsService.update(id, dto, req.user.id);
  }

  /**
   * Approve service return
   * POST /api/v1/service-returns/:id/approve
   */
  @Post(':id/approve')
  @Roles('HS', 'SPV', 'CMO', 'CSO')
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveServiceReturnDto,
    @Request() req: any,
  ) {
    return this.serviceReturnsService.approve(id, dto, req.user.id);
  }

  /**
   * Reject service return
   * POST /api/v1/service-returns/:id/reject
   */
  @Post(':id/reject')
  @Roles('HS', 'SPV', 'CMO', 'CSO')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectServiceReturnDto,
    @Request() req: any,
  ) {
    return this.serviceReturnsService.reject(id, dto, req.user.id);
  }

  /**
   * Create re-service order from approved return
   * POST /api/v1/service-returns/:id/re-service
   */
  @Post(':id/re-service')
  @Roles('HS', 'SPV', 'CMO', 'CSO')
  async createReService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReServiceDto,
    @Request() req: any,
  ) {
    return this.serviceReturnsService.createReService(id, dto, req.user.id);
  }

  /**
   * Resolve service return
   * POST /api/v1/service-returns/:id/resolve
   */
  @Post(':id/resolve')
  @Roles('HS', 'SPV', 'CMO', 'CSO')
  async resolve(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.serviceReturnsService.resolve(id, req.user.id);
  }
}

