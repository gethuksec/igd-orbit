import {
  User,
  UserRole,
  Role,
  RolePermission,
  Permission,
} from '@prisma/client';

/**
 * User with relations type
 */
type UserWithRelations = User & {
  userRoles?: (UserRole & {
    role: Role & {
      rolePermissions?: (RolePermission & {
        permission: Permission;
      })[];
    };
    branch?: { id: string; code: string; name: string } | null;
  })[];
  employee?: {
    id: string;
    employeeCode: string;
    branchId: string | null;
    departmentId: string | null;
    position: string | null;
    hireDate: Date | null;
    employmentType: string | null;
    basicSalary: any;
    hourlyRate: any;
    bankAccount: string | null;
    bankName: string | null;
    taxId: string | null;
    bpjsNumber: string | null;
    isActive: boolean;
    branch?: { id: string; code: string; name: string } | null;
    department?: { id: string; name: string } | null;
  } | null;
};

/**
 * Transformed user response
 */
export interface TransformedUser {
  id: string;
  email: string;
  username: string | null;
  fullName: string | null;
  phone: string | null;
  profilePhotoUrl: string | null;
  isActive: boolean;
  isVerified: boolean;
  twoFactorEnabled: boolean;
  canChangePassword: boolean;
  employeeCode?: string | null;
  departmentId?: string | null;
  employee?: {
    id: string;
    employeeCode: string;
    branchId: string | null;
    departmentId: string | null;
    position: string | null;
    hireDate: Date | null;
    employmentType: string | null;
    basicSalary: number | null;
    hourlyRate: number | null;
    bankAccount: string | null;
    bankName: string | null;
    taxId: string | null;
    bpjsNumber: string | null;
    isActive: boolean;
    branch?: { id: string; code: string; name: string } | null;
    department?: { id: string; name: string } | null;
  } | null;
  roles: Array<{
    id: string;
    code: string;
    name: string;
    branchId: string | null;
    branchName: string | null;
    isPrimary: boolean;
    validFrom: Date;
    validUntil: Date | null;
  }>;
  permissions: string[];
  branchIds: string[] | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * User Transformer
 * Transforms user entity to safe response format
 */
export class UserTransformer {
  /**
   * Transform user entity to safe response
   * @param user - User entity with relations
   * @returns Transformed user object without sensitive data
   */
  static transform(user: UserWithRelations): TransformedUser {
    const activeRoles = (user.userRoles || []).filter(
      (ur) => !ur.validUntil || ur.validUntil > new Date(),
    );

    const roles = activeRoles.map((ur) => ({
      id: ur.id, // UserRole ID (not role ID) - needed for removing role
      code: ur.role.code,
      name: ur.role.name,
      branchId: ur.branchId,
      branchName: ur.branch?.name || null,
      isPrimary: ur.isPrimary,
      validFrom: ur.validFrom,
      validUntil: ur.validUntil,
    }));

    const permissions = activeRoles
      .flatMap((ur) => ur.role.rolePermissions || [])
      .map(
        (rp) =>
          `${rp.permission.module}.${rp.permission.submodule || '*'}.${rp.permission.action}`,
      )
      .filter((p, index, self) => self.indexOf(p) === index)
      .sort();

    const branchIds = activeRoles
      .map((ur) => ur.branchId)
      .filter((id): id is string => id !== null);

    // Transform employee data if exists
    const employee = user.employee
      ? {
          id: user.employee.id,
          employeeCode: user.employee.employeeCode,
          branchId: user.employee.branchId,
          departmentId: user.employee.departmentId,
          position: user.employee.position,
          hireDate: user.employee.hireDate,
          employmentType: user.employee.employmentType,
          basicSalary: user.employee.basicSalary
            ? typeof user.employee.basicSalary === 'object' && 'toNumber' in user.employee.basicSalary
              ? (user.employee.basicSalary as any).toNumber()
              : user.employee.basicSalary
            : null,
          hourlyRate: user.employee.hourlyRate
            ? typeof user.employee.hourlyRate === 'object' && 'toNumber' in user.employee.hourlyRate
              ? (user.employee.hourlyRate as any).toNumber()
              : user.employee.hourlyRate
            : null,
          bankAccount: user.employee.bankAccount,
          bankName: user.employee.bankName,
          taxId: user.employee.taxId,
          bpjsNumber: user.employee.bpjsNumber,
          isActive: user.employee.isActive,
          branch: user.employee.branch || null,
          department: user.employee.department || null,
        }
      : null;

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      profilePhotoUrl: user.profilePhotoUrl,
      isActive: user.isActive,
      isVerified: user.isVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      canChangePassword: user.canChangePassword,
      employeeCode: (user as any).employeeCode || null,
      departmentId: (user as any).departmentId || null,
      employee,
      roles,
      permissions,
      branchIds: branchIds.length > 0 ? branchIds : null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt,
    };
  }

  /**
   * Transform array of users
   * @param users - Array of user entities
   * @returns Array of transformed user objects
   */
  static transformMany(users: UserWithRelations[]): TransformedUser[] {
    return users.map((user) => this.transform(user));
  }
}
