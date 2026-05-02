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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { RolesService } from './roles.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import {
  CreateRoleDto,
  UpdateRoleDto,
  AssignPermissionDto,
  CloneRoleDto,
  UpdateMenuAccessDto,
} from './dto';

/**
 * Roles Controller
 * Handles role management endpoints
 * 
 * Access Control: SUPERADMIN only (as per PRD)
 */
@Controller('roles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN') // All endpoints require SUPERADMIN
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * List all roles
   * GET /api/v1/roles
   */
  @Get()
  async findAll(@Query() query: any) {
    return this.rolesService.findAll(query);
  }

  /**
   * Get role by ID
   * GET /api/v1/roles/:id
   */
  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findById(id);
  }

  /**
   * Create new role
   * POST /api/v1/roles
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createRoleDto: CreateRoleDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.rolesService.create(createRoleDto, req.user.id);
  }

  /**
   * Update role
   * PUT /api/v1/roles/:id
   */
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.rolesService.update(id, updateRoleDto, req.user.id, req.user);
  }

  /**
   * Soft delete role
   * DELETE /api/v1/roles/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    await this.rolesService.softDelete(id, req.user.id, req.user);
  }

  /**
   * Get role permissions
   * GET /api/v1/roles/:id/permissions
   */
  @Get(':id/permissions')
  async getPermissions(@Param('id', ParseUUIDPipe) id: string) {
    const role = await this.rolesService.findById(id);
    return { permissions: role.permissions };
  }

  /**
   * Assign permission to role
   * POST /api/v1/roles/:id/permissions
   */
  @Post(':id/permissions')
  @HttpCode(HttpStatus.OK)
  async assignPermission(
    @Param('id', ParseUUIDPipe) roleId: string,
    @Body() assignPermissionDto: AssignPermissionDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.rolesService.assignPermission(
      roleId,
      assignPermissionDto,
      req.user.id,
    );
  }

  /**
   * Remove permission from role
   * DELETE /api/v1/roles/:id/permissions/:permissionId
   */
  @Delete(':id/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePermission(
    @Param('id', ParseUUIDPipe) roleId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    await this.rolesService.removePermission(roleId, permissionId, req.user.id);
  }

  /**
   * Clone role
   * POST /api/v1/roles/:id/clone
   */
  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  async cloneRole(
    @Param('id', ParseUUIDPipe) roleId: string,
    @Body() cloneRoleDto: CloneRoleDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.rolesService.cloneRole(roleId, cloneRoleDto, req.user.id);
  }

  /**
   * Get menu access for role
   * GET /api/v1/roles/:id/menu-access
   */
  @Get(':id/menu-access')
  async getMenuAccess(@Param('id', ParseUUIDPipe) roleId: string) {
    return this.rolesService.getMenuAccess(roleId);
  }

  /**
   * Update menu access for role
   * PUT /api/v1/roles/:id/menu-access
   */
  @Put(':id/menu-access')
  async updateMenuAccess(
    @Param('id', ParseUUIDPipe) roleId: string,
    @Body() updateMenuAccessDto: UpdateMenuAccessDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.rolesService.updateMenuAccess(
      roleId,
      updateMenuAccessDto.menuKeys,
      req.user.id,
    );
  }
}

