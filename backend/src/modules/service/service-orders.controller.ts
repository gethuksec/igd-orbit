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
} from '@nestjs/common';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AddPartsDto } from './dto/add-parts.dto';
import { QcCheckDto } from './dto/qc-check.dto';
import { CustomerFeedbackDto } from './dto/customer-feedback.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { UploadPhotosDto } from './dto/upload-photos.dto';

@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'TC', 'HS', 'SPV')
  async create(@Body() dto: CreateServiceOrderDto, @Request() req: any) {
    // Get branchId from user context or request
    const branchId = req.user.branchIds?.[0] || req.body.branchId;
    if (!branchId) {
      throw new Error('Branch ID is required');
    }
    return this.serviceOrdersService.create(dto, req.user.id, branchId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'TC', 'HS', 'SPV', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async findAll(
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('technicianId') technicianId?: string,
  ) {
    return this.serviceOrdersService.findAll(branchId, status, technicianId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'TC', 'HS', 'SPV', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async findById(@Param('id') id: string, @Request() req: any) {
    // Include password only for assigned technician or HS/SPV
    const includePassword =
      req.user.roles?.some((r: string) => ['TC', 'HS', 'SPV'].includes(r)) || false;
    return this.serviceOrdersService.findById(id, includePassword);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'TC', 'HS', 'SPV')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateServiceOrderDto>,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.update(id, dto, req.user.id);
  }

  @Post(':id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HS', 'SPV')
  async assignTechnician(
    @Param('id') id: string,
    @Body() dto: AssignTechnicianDto,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.assignTechnician(id, dto, req.user.id);
  }

  @Post(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TC', 'HS', 'SPV')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.updateStatus(id, dto, req.user.id);
  }

  @Post(':id/parts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TC', 'HS')
  async addParts(
    @Param('id') id: string,
    @Body() dto: AddPartsDto,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.addParts(id, dto, req.user.id);
  }

  @Post(':id/photos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'TC', 'HS', 'SPV')
  async uploadPhotos(
    @Param('id') id: string,
    @Body() dto: UploadPhotosDto,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.uploadPhotos(id, dto, req.user.id);
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TC', 'HS', 'SPV')
  async completeService(@Param('id') id: string, @Request() req: any) {
    return this.serviceOrdersService.completeService(id, req.user.id);
  }

  @Get('track/:serviceNumber')
  // Public endpoint - no auth required
  async trackService(@Param('serviceNumber') serviceNumber: string) {
    return this.serviceOrdersService.trackService(serviceNumber);
  }

  @Post(':id/qc')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HS', 'SPV') // QC staff role - can be customized
  async qcCheck(
    @Param('id') id: string,
    @Body() dto: QcCheckDto,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.qcCheck(id, dto, req.user.id);
  }

  @Post(':id/deliver')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'HS', 'SPV')
  async deliverService(@Param('id') id: string, @Request() req: any) {
    return this.serviceOrdersService.deliverService(id, req.user.id);
  }

  @Post(':id/feedback')
  // Public endpoint - no auth required for customer feedback
  async collectFeedback(
    @Param('id') id: string,
    @Body() dto: CustomerFeedbackDto,
  ) {
    return this.serviceOrdersService.collectFeedback(id, dto);
  }
}



