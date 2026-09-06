import { BadRequestException } from '@nestjs/common';

export const WAREHOUSE_TYPES = ['GOOD', 'BAD'] as const;
export const WAREHOUSE_SCOPES = ['OUTLET', 'SYSTEM'] as const;

export type WarehouseType = (typeof WAREHOUSE_TYPES)[number];
export type WarehouseScope = (typeof WAREHOUSE_SCOPES)[number];

export interface WarehouseIdentityInput {
  type?: string | null;
  scope?: string | null;
  outletId?: string | null;
}

export interface NormalizedWarehouseIdentity {
  type: WarehouseType;
  scope: WarehouseScope;
  outletId: string | null;
}

/**
 * Apply the inventory warehouse invariants at the application boundary.
 *
 * GOOD warehouses are outlet-owned except the single system-scoped
 * central-good warehouse. BAD is reserved for the single system-scoped
 * Central Bad Stock warehouse. System warehouses never carry an outlet.
 */
export function normalizeWarehouseIdentity(
  input: WarehouseIdentityInput,
): NormalizedWarehouseIdentity {
  const type = (input.type ?? 'GOOD').trim().toUpperCase();
  const scope = (input.scope ?? (type === 'BAD' ? 'SYSTEM' : 'OUTLET'))
    .trim()
    .toUpperCase();
  const outletId = input.outletId ?? null;

  if (!WAREHOUSE_TYPES.includes(type as WarehouseType)) {
    throw new BadRequestException('Warehouse type must be GOOD or BAD');
  }

  if (!WAREHOUSE_SCOPES.includes(scope as WarehouseScope)) {
    throw new BadRequestException('Warehouse scope must be OUTLET or SYSTEM');
  }

  if (scope === 'SYSTEM') {
    if (outletId !== null) {
      throw new BadRequestException(
        'System warehouses must not have an outlet (central-good / central-bad)',
      );
    }
  } else if (type !== 'GOOD' || !outletId) {
    throw new BadRequestException(
      'Outlet warehouses must be GOOD warehouses with an outlet',
    );
  }

  return {
    type: type as WarehouseType,
    scope: scope as WarehouseScope,
    outletId,
  };
}
