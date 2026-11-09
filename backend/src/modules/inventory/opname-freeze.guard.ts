import { BadRequestException } from '@nestjs/common';

/** Minimal prisma surface the freeze guard needs (PrismaService or a tx client both satisfy it). */
export type FreezeGuardPrisma = {
  warehouse: { findUnique: (args: any) => Promise<any> };
  stockOpname: { findFirst: (args: any) => Promise<any> };
};

/**
 * Statuses that keep a FREEZE session blocking. `completed` (counted, awaiting
 * approval) still blocks — stock only moves again after approval/cancel.
 */
export const FREEZE_BLOCKED_STATUSES = ['draft', 'counting', 'completed'];

/**
 * IGDERP-259 (warehouse PoV): per-warehouse FREEZE enforcement.
 * A warehouse is frozen while it has an active FREEZE session
 * (draft/counting/completed). Central SYSTEM warehouses are covered too —
 * a central opname freezes that central warehouse only, never the outlets.
 * OPEN sessions never block (trade continues + movement log).
 * Call from every warehouse-stock mutation (sales, transfers, stock-in/out,
 * adjustments, mutasi, service parts usage). The opname approval posting
 * itself never calls this — it is the only allowed writer.
 */
export async function assertNoFreezeOpname(
  prisma: FreezeGuardPrisma,
  warehouseId: string | null | undefined,
  action = 'record a stock movement',
): Promise<void> {
  if (!warehouseId) return;
  const active = await prisma.stockOpname.findFirst({
    where: {
      warehouseId,
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
