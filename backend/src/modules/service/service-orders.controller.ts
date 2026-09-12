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
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles } from '../../shared/decorators/roles.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { resolveBranchFilter } from '../../common/branch-access.util';
import { ServiceOrdersService } from './service-orders.service';
import { CreateServiceOrderDto } from './dto/create-service-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AddServiceTimeDto } from './dto/add-service-time.dto';
import { AddPartsDto } from './dto/add-parts.dto';
import { AddLayananDto } from './dto/add-layanan.dto';
import { CustomerFeedbackDto } from './dto/customer-feedback.dto';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { UploadPhotosDto } from './dto/upload-photos.dto';
import { ProcessPaymentDto } from './dto/payment.dto';

@Controller('service-orders')
export class ServiceOrdersController {
  constructor(private readonly serviceOrdersService: ServiceOrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'HS', 'SPV', 'SUPERADMIN')
  async create(
    @Body() dto: CreateServiceOrderDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    // Determine and validate branch based on user access
    // T21: global roles (SUPERADMIN/OWNER/CFO) may pass branchId from the form (selected outlet)
    const { branchId } = resolveBranchFilter(req, dto.branchId);
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
    const branchFilter = resolveBranchFilter(req, branchId);
    return this.serviceOrdersService.findAll(branchFilter, status, technicianId, search);
  }

  @Get('tags/suggest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'TC', 'HS', 'SPV', 'CMO', 'CFO', 'CHR', 'OWNER', 'SUPERADMIN')
  async suggestTags(@Query('q') q?: string, @Query('take') take?: string) {
    return this.serviceOrdersService.suggestTags(q, take ? Number(take) : 5);
  }

  // IGDERP-185: lock credential reveal — TC/HS/SPV only (parity with findById password gate).
  // Detail page already passed the branch check; audit line lands in status history.
  @Get(':id/lock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TC', 'HS', 'SPV')
  async revealLock(@Param('id') id: string, @Request() req: ExpressRequest & { user: any }) {
    return this.serviceOrdersService.revealLock(id, (req.user as any)?.id);
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
  @Roles('CS', 'HS', 'SPV', 'SUPERADMIN')
  async update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateServiceOrderDto>,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.update(id, dto, req.user.id);
  }

  @Post(':id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HS', 'SPV', 'SUPERADMIN')
  async assignTechnician(
    @Param('id') id: string,
    @Body() dto: AssignTechnicianDto,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.assignTechnician(id, dto, req.user.id);
  }

  @Post(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TC', 'HS', 'SPV', 'SUPERADMIN')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.updateStatus(id, dto, req.user.id);
  }

  /** IGDERP-134: Tambah Waktu — extend estimasi/SLA due & log (In Progress only) */
  @Post(':id/add-time')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TC', 'HS', 'SPV', 'SUPERADMIN')
  async addServiceTime(
    @Param('id') id: string,
    @Body() dto: AddServiceTimeDto,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.addTime(id, dto, req.user.id);
  }

  /** IGDERP-136: Tambah Layanan — one row at In Progress (CS/teknisi) */
  @Post(':id/layanan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'HS', 'SPV', 'SUPERADMIN', 'TC')
  async addLayanan(
    @Param('id') id: string,
    @Body() dto: AddLayananDto,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.addLayanan(id, dto, req.user.id);
  }

  @Post(':id/parts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'HS', 'SPV', 'SUPERADMIN')
  async addParts(
    @Param('id') id: string,
    @Body() dto: AddPartsDto,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.addParts(id, dto, req.user.id);
  }

  @Delete(':id/parts/:partId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('HS', 'SPV', 'SUPERADMIN')
  async removePart(
    @Param('id') id: string,
    @Param('partId') partId: string,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.removePart(id, partId, req.user.id);
  }

  @Delete(':id/layanan/:rowId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'HS', 'SPV', 'SUPERADMIN', 'TC')
  async removeLayanan(
    @Param('id') id: string,
    @Param('rowId') rowId: string,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.removeLayanan(id, rowId, req.user.id);
  }

  @Post(':id/photos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'HS', 'SPV', 'SUPERADMIN')
  async uploadPhotos(
    @Param('id') id: string,
    @Body() dto: UploadPhotosDto,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.uploadPhotos(id, dto, req.user.id);
  }

  // IGDERP-136 detail round: direct file upload per documentation stage
  // (multipart files[] + photoType; max 5 × 1MB images; volume-backed /uploads serve)
  @Post(':id/photos/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('CS', 'TC', 'HS', 'SPV', 'SUPERADMIN')
  @UseInterceptors(FilesInterceptor('files', 5))
  async uploadPhotoFiles(
    @Param('id') id: string,
    @UploadedFiles() files: Array<{ originalname: string; mimetype: string; size: number; buffer: Buffer }>,
    @Body() body: { photoType?: string; description?: string },
    @Request() req: any,
  ) {
    if (!files || files.length === 0) throw new BadRequestException('Minimal satu file foto wajib diunggah');
    return this.serviceOrdersService.uploadPhotoFiles(id, files, body?.photoType || 'repair', body?.description, req.user.id);
  }

  @Public()
  @Get('track/:serviceNumber')
  async trackService(@Param('serviceNumber') serviceNumber: string) {
    return this.serviceOrdersService.trackService(serviceNumber);
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
  @Roles('CS', 'HS', 'SPV', 'CMO', 'CFO', 'OWNER', 'SUPERADMIN')
  async processPayment(
    @Param('id') id: string,
    @Body() dto: ProcessPaymentDto,
    @Request() req: any,
  ) {
    return this.serviceOrdersService.processPayment(id, dto, req.user.id);
  }
}



