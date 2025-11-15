import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { PasswordService } from '../../shared/services';
import {
  CreateUserDto,
  UpdateUserDto,
  ListUsersDto,
  AssignRoleDto,
} from './dto';
import {
  UserTransformer,
  TransformedUser,
} from './transformers/user.transformer';
import { Prisma } from '@prisma/client';

/**
 * Users Service
 * Handles user management operations
 */
@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private passwordService: PasswordService,
  ) {}

  /**
   * Find all users with pagination and filters
   * @param query - Query parameters (pagination, search, filters)
   * @param currentUser - Current user for permission checks
   * @returns Paginated list of users
   */
  async findAll(query: ListUsersDto, currentUser: any) {
    const {
      page = 1,
      limit = 10,
      search,
      'filter[role]': filterRole,
      'filter[branch]': filterBranch,
      'filter[status]': filterStatus = 'active',
      sort = 'createdAt',
      order = 'desc',
    } = query;

    // Ensure page and limit are numbers (fallback if transform didn't work)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.UserWhereInput = {
      deletedAt:
        filterStatus === 'all'
          ? undefined
          : filterStatus === 'active'
            ? null
            : { not: null },
    };

    // Search filter
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Role filter
    if (filterRole) {
      const role = await this.prisma.role.findUnique({
        where: { code: filterRole },
      });
      if (role) {
        where.userRoles = {
          some: {
            roleId: role.id,
            OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          },
        };
      }
    }

    // Branch filter
    if (filterBranch) {
      where.userRoles = {
        ...where.userRoles,
        some: {
          branchId: filterBranch,
          OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
        },
      };
    }

    // Branch access restriction (non-admin users)
    if (
      !currentUser.roles.includes('SUPERADMIN') &&
      !currentUser.roles.includes('CHR')
    ) {
      if (currentUser.branchIds && currentUser.branchIds.length > 0) {
        where.userRoles = {
          ...where.userRoles,
          some: {
            branchId: { in: currentUser.branchIds },
            OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          },
        };
      }
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sort]: order },
        include: {
          userRoles: {
            where: {
              OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
            },
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
              branch: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: UserTransformer.transformMany(users),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Find user by ID with relations
   * @param id - User ID
   * @param currentUser - Current user for permission checks
   * @returns User detail
   */
  async findById(id: string, currentUser: any): Promise<TransformedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Permission check: non-admin can only view users in their branch
    if (
      !currentUser.roles.includes('SUPERADMIN') &&
      !currentUser.roles.includes('CHR')
    ) {
      if (currentUser.branchIds && currentUser.branchIds.length > 0) {
        const userBranchIds = user.userRoles
          .filter((ur) => !ur.validUntil || ur.validUntil > new Date())
          .map((ur) => ur.branchId)
          .filter((id): id is string => id !== null);

        const hasAccess = userBranchIds.some((bid) =>
          currentUser.branchIds.includes(bid),
        );

        if (!hasAccess && currentUser.id !== id) {
          throw new ForbiddenException('Access denied to this user');
        }
      } else if (currentUser.id !== id) {
        throw new ForbiddenException('Access denied to this user');
      }
    }

    return UserTransformer.transform(user);
  }

  /**
   * Find user by email
   * @param email - User email
   * @returns User or null
   */
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  /**
   * Create new user
   * @param createUserDto - User creation data
   * @param _createdBy - User ID who created this user (for audit trail)
   * @returns Created user
   */
  async create(
    createUserDto: CreateUserDto,
    _createdBy: string,
  ): Promise<TransformedUser> {
    // Check email uniqueness
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    // Check username uniqueness (if provided)
    if (createUserDto.username) {
      const existingUsername = await this.prisma.user.findUnique({
        where: { username: createUserDto.username },
      });

      if (existingUsername) {
        throw new ConflictException('Username already taken');
      }
    }

    // Validate password strength
    const passwordValidation = this.passwordService.validatePasswordStrength(
      createUserDto.password,
    );
    if (!passwordValidation.isValid) {
      throw new BadRequestException(passwordValidation.error);
    }

    // Hash password
    const passwordHash = await this.passwordService.hashPassword(
      createUserDto.password,
    );

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        username: createUserDto.username,
        passwordHash,
        fullName: createUserDto.fullName,
        phone: createUserDto.phone,
        isActive: true,
        isVerified: false,
        // Note: employeeCode and departmentId would be stored in Employee table
        // For now, we'll skip these as Employee model is placeholder
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return UserTransformer.transform(user);
  }

  /**
   * Update user
   * @param id - User ID
   * @param updateUserDto - User update data
   * @param _updatedBy - User ID who updated this user (for audit trail)
   * @returns Updated user
   */
  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    _updatedBy: string,
  ): Promise<TransformedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check email uniqueness (if updating email)
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }
    }

    // Check username uniqueness (if updating username)
    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const existingUsername = await this.prisma.user.findUnique({
        where: { username: updateUserDto.username },
      });

      if (existingUsername) {
        throw new ConflictException('Username already taken');
      }
    }

    // Hash password if provided
    let passwordHash = user.passwordHash;
    if (updateUserDto.password) {
      const passwordValidation = this.passwordService.validatePasswordStrength(
        updateUserDto.password,
      );
      if (!passwordValidation.isValid) {
        throw new BadRequestException(passwordValidation.error);
      }
      passwordHash = await this.passwordService.hashPassword(
        updateUserDto.password,
      );
    }

    // Update user
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        email: updateUserDto.email,
        username: updateUserDto.username,
        passwordHash,
        fullName: updateUserDto.fullName,
        phone: updateUserDto.phone,
        isActive: updateUserDto.isActive,
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return UserTransformer.transform(updatedUser);
  }

  /**
   * Soft delete user
   * @param id - User ID
   * @param _deletedBy - User ID who deleted this user (for audit trail)
   */
  async softDelete(id: string, _deletedBy: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has active sessions (check Redis for refresh tokens)
    // For now, we'll just check if user is active
    if (user.isActive) {
      // In production, check Redis for active refresh tokens
      // const refreshTokenKey = `refresh_token:${id}`;
      // const hasActiveSession = await this.redis.exists(refreshTokenKey);
      // if (hasActiveSession) {
      //   throw new BadRequestException('Cannot delete user with active sessions');
      // }
    }

    // Soft delete
    await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  /**
   * Assign role to user
   * @param userId - User ID
   * @param assignRoleDto - Role assignment data
   * @param assignedBy - User ID who assigned this role
   * @returns Updated user
   */
  async assignRole(
    userId: string,
    assignRoleDto: AssignRoleDto,
    assignedBy: string,
  ): Promise<TransformedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.role.findUnique({
      where: { id: assignRoleDto.roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check if OWNER role - only SUPERADMIN can assign
    if (role.code === 'OWNER') {
      const assigner = await this.prisma.user.findUnique({
        where: { id: assignedBy },
        include: {
          userRoles: {
            include: { role: true },
          },
        },
      });

      const assignerRoles = assigner?.userRoles.map((ur) => ur.role.code) || [];
      if (!assignerRoles.includes('SUPERADMIN')) {
        throw new ForbiddenException('Only SUPERADMIN can assign OWNER role');
      }
    }

    // Check for duplicate role assignment
    const existingAssignment = await this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId: assignRoleDto.roleId,
        branchId: assignRoleDto.branchId || null,
        OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
      },
    });

    if (existingAssignment) {
      throw new ConflictException('User already has this role assignment');
    }

    // Create role assignment
    await this.prisma.userRole.create({
      data: {
        userId,
        roleId: assignRoleDto.roleId,
        branchId: assignRoleDto.branchId || null,
        isPrimary: assignRoleDto.isPrimary || false,
        validFrom: assignRoleDto.validFrom
          ? new Date(assignRoleDto.validFrom)
          : new Date(),
        validUntil: assignRoleDto.validUntil
          ? new Date(assignRoleDto.validUntil)
          : null,
      },
    });

    // Return updated user
    return this.findById(userId, { roles: ['SUPERADMIN'], branchIds: null });
  }

  /**
   * Remove role from user
   * @param userId - User ID
   * @param roleId - Role ID
   * @param _removedBy - User ID who removed this role (for audit trail)
   */
  async removeRole(
    userId: string,
    roleId: string,
    _removedBy: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check if system role - cannot be deleted
    if (role.isSystemRole) {
      throw new BadRequestException('Cannot remove system role');
    }

    // Find and delete role assignment
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        roleId,
      },
    });

    if (!userRole) {
      throw new NotFoundException('Role assignment not found');
    }

    await this.prisma.userRole.delete({
      where: { id: userRole.id },
    });
  }

  /**
   * Get user's effective permissions
   * @param userId - User ID
   * @returns Array of permission strings
   */
  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          where: {
            OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }],
          },
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const permissions = user.userRoles
      .flatMap((ur) => ur.role.rolePermissions)
      .map(
        (rp) =>
          `${rp.permission.module}.${rp.permission.submodule || '*'}.${rp.permission.action}`,
      )
      .filter((p, index, self) => self.indexOf(p) === index)
      .sort();

    return permissions;
  }
}
