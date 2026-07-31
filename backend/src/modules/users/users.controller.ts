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
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard, RolesGuard } from '../../shared/guards';
import { Roles } from '../../shared/decorators';
import {
  CreateUserDto,
  UpdateUserDto,
  ListUsersDto,
  AssignRoleDto,
} from './dto';

/**
 * Users Controller
 * Handles user management endpoints
 */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * List users with pagination and filters
   * GET /api/v1/users
   * Permissions: All authenticated users (filtered by branch if not admin)
   */
  @Get()
  async findAll(
    @Query() query: ListUsersDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.usersService.findAll(query, req.user);
  }

  /**
   * List technicians (users with TC role)
   * GET /api/v1/users/technicians?branchId=X
   * Permissions: All service-related roles
   */
  @Get('technicians')
  @UseGuards(RolesGuard)
  @Roles('SUPERADMIN', 'OWNER', 'CFO', 'MGR', 'CSO', 'CMO', 'SPV', 'HS', 'TC', 'CS', 'SODO', 'ASA', 'AR', 'AS', 'SMO', 'CR')
  async findTechnicians(
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findTechnicians({ branchId, search });
  }

  /**
   * Get user detail with roles
   * GET /api/v1/users/:id
   * Permissions: All authenticated users (own profile or admin)
   */
  @Get(':id')
  async findById(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.usersService.findById(id, req.user);
  }

  /**
   * Create new user
   * POST /api/v1/users
   * Permissions: CHR, SUPERADMIN
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('CHR', 'SUPERADMIN')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createUserDto: CreateUserDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.usersService.create(createUserDto, req.user.id);
  }

  /**
   * Update user
   * PUT /api/v1/users/:id
   * Permissions: CHR, SUPERADMIN, Self (limited fields)
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    // Allow self-update for limited fields (if not admin)
    if (
      id === req.user.id &&
      !req.user.roles.includes('CHR') &&
      !req.user.roles.includes('SUPERADMIN')
    ) {
      // Self-update: only allow basic fields
      const filteredDto: UpdateUserDto = {};

      if (updateUserDto.fullName !== undefined) {
        filteredDto.fullName = updateUserDto.fullName;
      }
      if (updateUserDto.phone !== undefined) {
        filteredDto.phone = updateUserDto.phone;
      }

      if (Object.keys(filteredDto).length === 0) {
        throw new Error('No allowed fields to update');
      }

      return this.usersService.update(id, filteredDto, req.user.id);
    }

    // Admin update - require role guard
    // Note: We need to check roles manually since we can't conditionally apply guards
    if (
      !req.user.roles.includes('CHR') &&
      !req.user.roles.includes('SUPERADMIN')
    ) {
      throw new Error('Access denied. Required roles: CHR, SUPERADMIN');
    }

    return this.usersService.update(id, updateUserDto, req.user.id);
  }

  /**
   * Soft delete user
   * DELETE /api/v1/users/:id
   * Permissions: CHR, SUPERADMIN
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'SUPERADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    await this.usersService.softDelete(id, req.user.id);
  }

  /**
   * Assign role to user
   * POST /api/v1/users/:id/roles
   * Permissions: CHR, SUPERADMIN
   */
  @Post(':id/roles')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'SUPERADMIN')
  @HttpCode(HttpStatus.OK)
  async assignRole(
    @Param('id') userId: string,
    @Body() assignRoleDto: AssignRoleDto,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.usersService.assignRole(userId, assignRoleDto, req.user.id);
  }

  /**
   * Remove role from user
   * DELETE /api/v1/users/:id/roles/:roleId
   * Permissions: CHR, SUPERADMIN
   */
  @Delete(':id/roles/:roleId')
  @UseGuards(RolesGuard)
  @Roles('CHR', 'SUPERADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeRole(
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    await this.usersService.removeRole(userId, roleId, req.user.id);
  }

  /**
   * Reactivate a banned user
   * POST /api/v1/users/:id/reactivate
   * Permissions: SPV, HS, CHR
   */
  @Post(':id/reactivate')
  @UseGuards(RolesGuard)
  @Roles('SPV', 'HS', 'CHR')
  @HttpCode(HttpStatus.OK)
  async reactivate(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    return this.usersService.reactivate(id, req.user.id);
  }

  /**
   * Get user's effective permissions
   * GET /api/v1/users/:id/permissions
   * Permissions: All authenticated users (own permissions or admin)
   */
  @Get(':id/permissions')
  async getUserPermissions(
    @Param('id') id: string,
    @Request() req: ExpressRequest & { user: any },
  ) {
    // Allow users to view their own permissions
    if (
      id !== req.user.id &&
      !req.user.roles.includes('CHR') &&
      !req.user.roles.includes('SUPERADMIN')
    ) {
      throw new Error('Access denied. You can only view your own permissions');
    }

    const permissions = await this.usersService.getUserPermissions(id);
    return { permissions };
  }
}
