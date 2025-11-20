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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';

/**
 * Permissions Controller
 * Handles permission management endpoints
 * 
 * Access Control:
 * - View: OWNER, SUPERADMIN, CHR (as per PRD)
 * - Create/Update: SUPERADMIN only
 */
@Controller('permissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  /**
   * List all permissions, grouped by module
   * GET /api/v1/permissions
   * Access: OWNER, SUPERADMIN, CHR
   */
  @Get()
  @Roles('OWNER', 'SUPERADMIN', 'CHR')
  async findAllGrouped() {
    return this.permissionsService.findAllGrouped();
  }

  /**
   * List all permissions (flat list with pagination)
   * GET /api/v1/permissions/list
   * Access: OWNER, SUPERADMIN, CHR
   */
  @Get('list')
  @Roles('OWNER', 'SUPERADMIN', 'CHR')
  async findAll(@Query() query: any) {
    return this.permissionsService.findAll(query);
  }

  /**
   * Get permission by ID
   * GET /api/v1/permissions/:id
   * Access: OWNER, SUPERADMIN, CHR
   */
  @Get(':id')
  @Roles('OWNER', 'SUPERADMIN', 'CHR')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.permissionsService.findById(id);
  }

  /**
   * Create permission
   * POST /api/v1/permissions
   * Access: SUPERADMIN only
   */
  @Post()
  @Roles('SUPERADMIN')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() data: {
      module: string;
      submodule?: string;
      action: string;
      description?: string;
    },
    @Request() _req: ExpressRequest & { user: any },
  ) {
    return this.permissionsService.create(data);
  }

  /**
   * Update permission (description only)
   * PUT /api/v1/permissions/:id
   * Access: SUPERADMIN only
   */
  @Put(':id')
  @Roles('SUPERADMIN')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: { description?: string },
    @Request() _req: ExpressRequest & { user: any },
  ) {
    return this.permissionsService.update(id, data);
  }
}

