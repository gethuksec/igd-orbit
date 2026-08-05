/**
 * Shared permission utilities — SINGLE source of truth for the permission model.
 *
 * Decision (Plane #61 D-PERM, 2026-08-06):
 * - Static permission-key catalog in code (no DB catalog table)
 * - ONE merge function used by login, refresh, jwt.strategy, user detail, guards
 * - Redis permVersion (`auth:ver:{userId}`) invalidates JWTs on permission changes
 *
 * NOTE: the legacy RolePermission junction is still read (backward compat with the
 * module wildcard keys like `master_data.*.view` that the FE sidebar depends on).
 * D1 removes the junction tables; at that point remove the junction loop below and
 * ensure role.defaultPermissions carries the wildcard keys (D6 data migration).
 */

/** Redis key prefix for the per-user permission version. */
export const PERM_VERSION_PREFIX = 'auth:ver:';

export function getPermissionVersionKey(userId: string): string {
  return `${PERM_VERSION_PREFIX}${userId}`;
}

/**
 * Bump a user's permission version — invalidates all currently-issued JWTs
 * (they carry an older permVer claim → jwt.strategy returns 401 → client
 * auto-refreshes via T22 and gets a fresh token with new permissions).
 */
export async function bumpPermissionVersion(
  redis: { incr(key: string): Promise<number> },
  userId: string,
): Promise<void> {
  try {
    await redis.incr(getPermissionVersionKey(userId));
  } catch (e) {
    // Redis unavailable — fail open but log. Security relies on Redis being up;
    // without the bump, changes apply at next login/refresh (≤1h token TTL).
    console.warn(
      `[D-PERM] Could not bump permission version for user ${userId}:`,
      e,
    );
  }
}

/**
 * Shape of a userRole row with everything the merge needs.
 * Compatible with Prisma's include: { role: { include: { rolePermissions: { include: { permission: true } } } } }
 */
export interface MergeUserRole {
  role: {
    code?: string;
    defaultPermissions?: string[];
    rolePermissions?: Array<{
      permission: {
        module: string;
        submodule?: string | null;
        action: string;
      };
    }>;
  };
  deniedPermissions?: string[];
}

/**
 * THE single merge function.
 *
 * effective = (∪ role.rolePermissions junction keys) ∪ (∪ role.defaultPermissions)
 *             − (∪ assignment.deniedPermissions)
 *
 * Used by: auth login, auth refresh, jwt.strategy, user detail, roles service.
 */
export function computeEffectivePermissions(userRoles: MergeUserRole[]): string[] {
  const permissionSet = new Set<string>();

  for (const ur of userRoles || []) {
    // Legacy junction (module.submodule.action) — removed in D1
    for (const rp of ur.role?.rolePermissions || []) {
      permissionSet.add(
        `${rp.permission.module}.${rp.permission.submodule || '*'}.${rp.permission.action}`,
      );
    }
    // New model: role.defaultPermissions
    for (const perm of ur.role?.defaultPermissions || []) {
      permissionSet.add(perm);
    }
  }

  // Subtract deniedPermissions (per-assignment, deny-only model)
  for (const ur of userRoles || []) {
    for (const denied of ur.deniedPermissions || []) {
      permissionSet.delete(denied);
    }
  }

  return [...permissionSet].sort();
}

/**
 * Static permission-key catalog (vocabulary of everything gating code may check).
 * Mirrors frontend/src/config/permission-catalog.ts — keep in sync.
 * Sourced from the union of role.default_permissions in prod (2026-08-06, ~100 keys)
 * plus the legacy module-wildcard keys served by the old junction.
 */
export const PERMISSION_CATALOG: string[] = [
  // Menu visibility
  'menu.dashboard',
  'menu.pos',
  'menu.service',
  'menu.sales',
  'menu.master-data',
  'menu.inventory',
  'menu.finance',
  'menu.purchasing',
  'menu.hr',
  'menu.users',
  'menu.branches',
  // Generic
  'action.view',
  'action.pos.create',
  'action.pos.edit',
  'action.service.view',
  'action.service.create',
  'action.service.edit',
  'action.service.delete',
  'action.service.assign',
  'action.service.smart_repair.create',
  // Dashboard
  'dashboard.view',
  'dashboard.*.view',
  // Master data
  'master_data.customer.view',
  'master_data.customer.create',
  'master_data.customer.edit',
  'master_data.customer.delete',
  'master_data.product.view',
  'master_data.product.create',
  'master_data.product.edit',
  'master_data.product.delete',
  'master_data.supplier.view',
  'master_data.supplier.create',
  'master_data.supplier.edit',
  'master_data.supplier.delete',
  'master_data.category.view',
  'master_data.category.create',
  'master_data.category.edit',
  'master_data.category.delete',
  'master_data.brand.view',
  'master_data.brand.create',
  'master_data.brand.edit',
  'master_data.brand.delete',
  'master_data.attribute.view',
  'master_data.attribute.create',
  'master_data.attribute.edit',
  'master_data.attribute.delete',
  'master_data.service_type.view',
  'master_data.service_type.create',
  'master_data.service_type.edit',
  'master_data.service_type.delete',
  'master_data.*.view',
  // Sales / POS
  'sales.history.view',
  'sales.return.create',
  'sales.return.edit',
  'sales.pos.view',
  'sales.pos.create',
  'sales.pos.edit',
  'sales.pos.delete',
  'sales.returns.create',
  'sales.*.view',
  'sales.*.create',
  // Service
  'service.order.view',
  'service.order.my',
  'service.checkpoint.view',
  'service.checkpoint.create',
  'service.checkpoint.edit',
  'service.checkpoint.delete',
  'service.return.create',
  'service.return.edit',
  'service.*.view',
  // Inventory
  'inventory.stock.view',
  'inventory.stock.adjust',
  'inventory.transfer.create',
  'inventory.transfer.approve',
  'inventory.opname.create',
  'inventory.opname.approve',
  'inventory.history.view',
  'inventory.alert.view',
  'inventory.*.view',
  // Finance
  'finance.coa.view',
  'finance.coa.create',
  'finance.coa.edit',
  'finance.journal.create',
  'finance.expense.create',
  'finance.petty_cash.create',
  'finance.ar.create',
  'finance.report.view',
  'finance.*.view',
  // Purchasing
  'purchasing.supplier.view',
  'purchasing.supplier.create',
  'purchasing.supplier.edit',
  'purchasing.po.create',
  'purchasing.po.approve',
  'purchasing.po.receive',
  'purchasing.*.view',
  // HR
  'hr.employee.view',
  'hr.employee.create',
  'hr.employee.edit',
  'hr.employee.deactivate',
  'hr.attendance.view',
  'hr.leave.approve',
  'hr.payroll.view',
  'hr.kpi.create',
  'hr.*.view',
  // Users / Roles / Branches
  'users.user.view',
  'users.user.create',
  'users.user.edit',
  'users.user.deactivate',
  'users.password.approve',
  'roles.role.view',
  'roles.role.create',
  'roles.role.edit',
  'roles.role.delete',
  'users.*.view',
  'roles.*.view',
  'branch.view',
];

/** SUPERADMIN always bypasses permission checks (hardcoded everywhere). */
export const SUPERADMIN_ROLE = 'SUPERADMIN';
