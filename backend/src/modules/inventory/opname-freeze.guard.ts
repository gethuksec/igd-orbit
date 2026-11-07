import { BadRequestException } from '@nestjs/common';

/** Minimal prisma surface the freeze guard needs (PrismaService or a tx client both satisfy it). */
export type FreezeGuardPrisma = {
  warehouse: { findUnique: (args: any) => Promise<any> };
  stockOpname: { findFirst: (args: any) => Promise<any> };
};

/**
 * Statuses that keep a FREEZE session blocking. `completed` (counted, awaiting
 * approval) still blocks — stock only moves again after approval/closed.
 * (OP4 adds `review` here when the D2 flow lands.)
 */
export const FREEZE_BLOCKED_STATUSES = ['draft', 'counting', 'completed'];

/**
 * IGDERP-233 (OP1): strict FREEZE enforcement — outlet-wide.
 * An outlet can own several GOOD warehouses (e.g. "Gudang" + "Gudang Cabang"),
 * but a stock opname counts the outlet as one truth: a sale from a sibling
 * warehouse corrupts the count just as much. So the guard resolves the
 * warehouse's outlet and throws when an active FREEZE session covers ANY
 * warehouse of that outlet (sessions store the outlet in `branchId`).
 * Call from every outlet-stock mutation (sales, transfers, stock-in/out,
 * adjustments, service parts usage). The opname approval posting itself never
 * calls this — it is the only allowed writer.
 */
export async function assertNoFreezeOpname(
  prisma: FreezeGuardPrisma,
  warehouseId: string | null | undefined,
  action = 'record a stock movement',
): Promise<void> {
  if (!warehouseId) return;
  const warehouse = await prisma.warehouse.findUnique({
    where: { id: warehouseId },
    select: { id: true, outletId: true },
  });
  // System-scoped warehouses (e.g. Central BAD, outletId null) are never
  // opname-covered — returns and damage flows keep working during a freeze.
  if (!warehouse?.outletId) return;
  const active = await prisma.stockOpname.findFirst({
    where: {
      branchId: warehouse.outletId,
      opnameType: 'FREEZE',
      status: { in: FREEZE_BLOCKED_STATUSES },
    },
  });
  if (active) {
    throw new BadRequestException(
      `Stock is frozen for opname ${active.opnameNumber ?? active.code} — cannot ${action} until the opname is approved.`,
    );
  }
}
