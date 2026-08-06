import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { buildPerWordSearch } from '../../shared/services/search.utils';
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
import { Decimal } from '@prisma/client/runtime/library';
import Redis from 'ioredis';
import { Inject } from '@nestjs/common';
import {
  bumpPermissionVersion,
  computeEffectivePermissions,
  isPermissionWithinDefaults,
} from '../../shared/utils/permissions.util';

/**
 * Users Service
 * Handles user management operations
 */
@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private passwordService: PasswordService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Find technicians (users with TC role), optionally filtered by branch
   * @param options - { branchId?, search? }
   * @returns List of technician users (id, fullName, email, phone, employeeCode)
   */
  async findTechnicians(options: { branchId?: string; search?: string } = {}) {
    const { branchId, search } = options;

    const tcRole = await this.prisma.role.findUnique({
      where: { code: 'TC' },
    });

    if (!tcRole) {
      return [];
    }

    const where: Prisma.UserWhereInput = {
      isActive: true,
      deletedAt: null,
      userBranches: {
        some: {
          roleId: tcRole.id,
          ...(branchId ? { branchId } : {}),
        },
      },
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { fullName: 'asc' },
      include: {
        employee: {
          select: {
            employeeCode: true,
            position: true,
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      employeeCode: u.employee?.employeeCode ?? null,
      position: u.employee?.position ?? null,
    }));
  }

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

    // Search filter - per-word AND search across fields
    if (search) {
      where.AND = buildPerWordSearch(search, [
        'email',
        'username',
        'fullName',
      ]);
    }

    // Role filter
    if (filterRole) {
      const role = await this.prisma.role.findUnique({
        where: { code: filterRole },
      });
      if (role) {
        where.userBranches = {
          some: {
            roleId: role.id,
          },
        };
      }
    }

    // Branch filter
    if (filterBranch) {
      where.userBranches = {
        ...where.userBranches,
        some: {
          branchId: filterBranch,
        },
      };
    }

    // Branch access restriction (non-admin users)
    if (
      !currentUser.roles.includes('SUPERADMIN') &&
      !currentUser.roles.includes('CHR')
    ) {
      if (currentUser.branchIds && currentUser.branchIds.length > 0) {
        where.userBranches = {
          ...where.userBranches,
          some: {
            branchId: { in: currentUser.branchIds },
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
          userBranches: {
                        include: {
              role: true,
              branch: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
          employee: {
            include: {
              branch: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
              department: {
                select: {
                  id: true,
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
        userBranches: {
          include: {
            role: true,
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
        employee: {
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            department: {
              select: {
                id: true,
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
        const userBranchIds = user.userBranches
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
        userBranches: {
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

    // Generate employee code if not provided
    let employeeCode = createUserDto.employeeCode;
    if (!employeeCode) {
      // Find the highest employee code number
      const lastEmployee = await this.prisma.employee.findFirst({
        orderBy: { employeeCode: 'desc' },
        where: {
          employeeCode: {
            startsWith: 'EMP-',
          },
        },
      });

      if (lastEmployee) {
        const lastNumber = parseInt(lastEmployee.employeeCode.replace('EMP-', ''), 10);
        employeeCode = `EMP-${String(lastNumber + 1).padStart(4, '0')}`;
      } else {
        employeeCode = 'EMP-0001';
      }
    }

    // Create user and employee in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: createUserDto.email,
          username: createUserDto.username,
          passwordHash,
          fullName: createUserDto.fullName,
          phone: createUserDto.phone,
          isActive: true,
          isVerified: false,
        },
      });

      // Automatically create employee record for every user
      await tx.employee.create({
        data: {
          userId: user.id,
          employeeCode,
          branchId: createUserDto.departmentId ? null : null, // Will be set later if needed
          departmentId: createUserDto.departmentId || null,
          position: null, // Will be set later if needed
          isActive: true,
        },
      });

      // Fetch user with all relations
      return await tx.user.findUnique({
        where: { id: user.id },
        include: {
          employee: {
            include: {
              branch: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
              department: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
          userBranches: {
            include: {
              role: true,
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
    });

    return UserTransformer.transform(result!);
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
        canChangePassword: updateUserDto.canChangePassword,
      },
      include: {
        employee: {
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        userBranches: {
          include: {
            role: true,
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

    // Update employee data if provided
    if (updatedUser.employee) {
      const employeeUpdateData: any = {};
      if (updateUserDto.employeeCode !== undefined)
        employeeUpdateData.employeeCode = updateUserDto.employeeCode;
      if (updateUserDto.branchId !== undefined)
        employeeUpdateData.branchId = updateUserDto.branchId || null;
      if (updateUserDto.departmentId !== undefined)
        employeeUpdateData.departmentId = updateUserDto.departmentId || null;
      if (updateUserDto.position !== undefined)
        employeeUpdateData.position = updateUserDto.position;
      if (updateUserDto.hireDate !== undefined)
        employeeUpdateData.hireDate = updateUserDto.hireDate
          ? new Date(updateUserDto.hireDate)
          : null;
      if (updateUserDto.employmentType !== undefined)
        employeeUpdateData.employmentType = updateUserDto.employmentType;
      if (updateUserDto.basicSalary !== undefined)
        employeeUpdateData.basicSalary =
          updateUserDto.basicSalary !== null
            ? new Decimal(updateUserDto.basicSalary)
            : null;
      if (updateUserDto.hourlyRate !== undefined)
        employeeUpdateData.hourlyRate =
          updateUserDto.hourlyRate !== null
            ? new Decimal(updateUserDto.hourlyRate)
            : null;
      if (updateUserDto.bankAccount !== undefined)
        employeeUpdateData.bankAccount = updateUserDto.bankAccount;
      if (updateUserDto.bankName !== undefined)
        employeeUpdateData.bankName = updateUserDto.bankName;
      if (updateUserDto.taxId !== undefined)
        employeeUpdateData.taxId = updateUserDto.taxId;
      if (updateUserDto.bpjsNumber !== undefined)
        employeeUpdateData.bpjsNumber = updateUserDto.bpjsNumber;
      if (updateUserDto.isActive !== undefined)
        employeeUpdateData.isActive = updateUserDto.isActive;

      if (Object.keys(employeeUpdateData).length > 0) {
        await this.prisma.employee.update({
          where: { id: updatedUser.employee.id },
          data: employeeUpdateData,
        });
      }
    }

    // Fetch updated user with employee data
    const finalUser = await this.prisma.user.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            branch: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        userBranches: {
          include: {
            role: true,
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

    // D-PERM: invalidate user's JWTs if active-state or password changed
    if (
      updateUserDto.isActive !== undefined ||
      updateUserDto.password !== undefined
    ) {
      await bumpPermissionVersion(this.redis, id);
    }

    return UserTransformer.transform(finalUser!);
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

    // D-PERM: invalidate user's JWTs — deactivated/deleted
    await bumpPermissionVersion(this.redis, id);
  }

  /**
   * Reactivate a banned user
   * POST /users/:id/reactivate
   * Resets isActive = true, clears failed login attempts
   * @param id - User ID to reactivate
   * @param reactivatedBy - User ID who reactivated
   */
  async reactivate(id: string, _reactivatedBy: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        userBranches: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.isActive) {
      throw new BadRequestException("User is already active");
    }

    // Superadmin cannot be reactivated via API - must use DB recovery
    if (user.userBranches?.some((ur) => ur.role.code === "SUPERADMIN")) {
      throw new ForbiddenException(
        "Superadmin cannot be reactivated via API. Use database recovery.",
      );
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        isActive: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
        banReason: null,
      },
    });

    // D-PERM: invalidate user's JWTs — reactivated (fresh permissions)
    await bumpPermissionVersion(this.redis, id);

    return { message: "User reactivated successfully" };
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
          userBranches: {
            include: { role: true },
          },
        },
      });

      const assignerRoles = assigner?.userBranches.map((ur) => ur.role.code) || [];
      if (!assignerRoles.includes('SUPERADMIN')) {
        throw new ForbiddenException('Only SUPERADMIN can assign OWNER role');
      }
    }

    // D1: branchId required — default to first-in-list branch (decision #32)
    let resolvedBranchId = assignRoleDto.branchId;
    if (!resolvedBranchId) {
      const firstBranch = await this.prisma.branch.findFirst({
        where: { isActive: true },
        orderBy: [{ createdAt: 'asc' }, { code: 'asc' }],
      });
      if (!firstBranch) {
        throw new BadRequestException('No active branch available for role assignment');
      }
      resolvedBranchId = firstBranch.id;
    }

    // Decision #31: deny-only — deniedPermissions can NEVER exceed role defaults
    if (assignRoleDto.deniedPermissions && assignRoleDto.deniedPermissions.length > 0) {
      const beyondDefaults = assignRoleDto.deniedPermissions.filter(
        (p) => !isPermissionWithinDefaults(p, role.defaultPermissions || []),
      );
      if (beyondDefaults.length > 0) {
        throw new BadRequestException(
          `Cannot deny permissions beyond role defaults: ${beyondDefaults.join(', ')}`,
        );
      }
    }

    // Check for duplicate role assignment
    const existingAssignment = await this.prisma.userBranch.findFirst({
      where: {
        userId,
        roleId: assignRoleDto.roleId,
        branchId: resolvedBranchId,
      },
    });

    if (existingAssignment) {
      throw new ConflictException('User already has this role assignment');
    }

    // Create role assignment
    await this.prisma.userBranch.create({
      data: {
        userId,
        roleId: assignRoleDto.roleId,
        branchId: resolvedBranchId,
        isPrimary: assignRoleDto.isPrimary || false,
        deniedPermissions: assignRoleDto.deniedPermissions || [],
      },
    });

    // D-PERM: invalidate user's JWTs — permissions changed
    await bumpPermissionVersion(this.redis, userId);

    // Return updated user
    return this.findById(userId, { roles: ['SUPERADMIN'], branchIds: null });
  }

  /**
   * Remove a role assignment (UserBranch) from a user.
   * The :roleId path param is the USERBRANCH id (transformer `roles[].id`),
   * not the Role id — the FE always has the assignment id in hand.
   */
  async removeRole(
    userId: string,
    userRoleId: string,
    _removedBy: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find the exact assignment row (user-scoped) and delete it
    const userBranch = await this.prisma.userBranch.findFirst({
      where: {
        id: userRoleId,
        userId,
      },
    });

    if (!userBranch) {
      throw new NotFoundException('Role assignment not found');
    }

    await this.prisma.userBranch.delete({
      where: { id: userBranch.id },
    });

    // D-PERM: invalidate user's JWTs — role removed
    await bumpPermissionVersion(this.redis, userId);
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
        userBranches: {
                    include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // D-PERM: single merge function (junction + defaultPermissions - deniedPermissions)
    return computeEffectivePermissions(user.userBranches);
  }
}
