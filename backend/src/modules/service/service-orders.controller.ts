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
  ForbiddenException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AddPartsDto } from './dto/add-parts.dto';
import { QcCheckDto } from './dto/qc-check.dto';
import { CustomerFeedbackDto } from './dto/customer-feedback.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { UploadPhotosDto } from './dto/upload-photos.dto';
import { ProcessPaymentDto } from './dto/payment.dto';

// Helper to enforce branch access and prevent IDOR
const ensureBranchAccess = (req: ExpressRequest & { user: any }, branchId?: string) => {
  const userBranchIds: string[] = (req.user as any)?.branchIds || [];
  const userRoles: string[] = (req.user as any)?.roles || [];

  const isGlobalRole =
    userRoles.includes('OWNER') || userRoles.includes('CFO') || userRoles.includes('SUPERADMIN');

  // Global roles can access any / all branches
  if (isGlobalRole) {
    return branchId;
  }

  if (!userBranchIds || userBranchIds.length === 0) {
    throw new ForbiddenException('You do not have any branch access.');
  }

  // If specific branch requested, ensure it is allowed
  if (branchId) {
    if (!userBranchIds.includes(branchId)) {
      throw new ForbiddenException('You do not have access to this branch.');
    }
    return branchId;
  }

  // No branch specified → default to first allowed branch
  return userBranchIds[0];
};

@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'TC', 'HS', 'SPV')
  async create(
    @Body() dto: CreateServiceOrderDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    // Determine and validate branch based on user access
    const branchId = ensureBranchAccess(req, undefined) as string;
    if (!branchId) {
      throw new ForbiddenException('Branch ID is required');
    }
    return this.serviceOrdersService.create(dto, req.user.id, branchId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'TC', 'HS', 'SPV', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async findAll(
    @Request() req: ExpressRequest & { user: any },
    @Query('branchId') branchId?: string,
    @Query('status') status?: string,
    @Query('technicianId') technicianId?: string,
    @Query('search') search?: string,
  ) {
    const effectiveBranchId = ensureBranchAccess(req, branchId);
    return this.serviceOrdersService.findAll(effectiveBranchId, status, technicianId, search);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'TC', 'HS', 'SPV', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async findById(@Param('id') id: string, @Request() req: ExpressRequest & { user: any }) {
    // Include password only for assigned technician or HS/SPV
    const includePassword =
      ((req.user as any).roles as string[])?.some((r) => ['TC', 'HS', 'SPV'].includes(r)) || false;

    const order = await this.serviceOrdersService.findById(id, includePassword);

    // Enforce branch access for non-global roles
    const userBranchIds: string[] = (req.user as any)?.branchIds || [];
    const userRoles: string[] = (req.user as any)?.roles || [];
    const isGlobalRole =
      userRoles.includes('OWNER') || userRoles.includes('CFO') || userRoles.includes('SUPERADMIN');

    if (!isGlobalRole && order.branchId && !userBranchIds.includes(order.branchId)) {
      throw new ForbiddenException('You do not have access to this service order.');
    }

    return order;
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

  @Delete(':id/parts/:partId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TC', 'HS', 'SPV')
  async removePart(
    @Param('id') id: string,
    @Param('partId') partId: string,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.removePart(id, partId, req.user.id);
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

  @Public()
  @Get('track/:serviceNumber')
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

  @Public()
  @Post(':id/feedback')
  async collectFeedback(
    @Param('id') id: string,
    @Body() dto: CustomerFeedbackDto,
  ) {
    return this.serviceOrdersService.collectFeedback(id, dto);
  }

  @Post(':id/payment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'HS', 'SPV', 'CMO', 'CFO', 'OWNER')
  async processPayment(
    @Param('id') id: string,
    @Body() dto: ProcessPaymentDto,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.processPayment(id, dto, req.user.id);
  }
}



