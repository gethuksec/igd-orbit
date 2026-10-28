import { BadRequestException } from '@nestjs/common';

/** Minimal prisma surface the freeze guard needs (PrismaService or a tx client both satisfy it). */
export type FreezeGuardPrisma = {
  stockOpname: { findFirst: (args: any) => Promise<any> };
};

/**
 * Statuses that keep a FREEZE session blocking. `completed` (counted, awaiting
 * approval) still blocks — stock only moves again after approval/closed.
 * (OP4 adds `review` here when the D2 flow lands.)
 */
export const FREEZE_BLOCKED_STATUSES = ['draft', 'counting', 'completed'];

/**
 * IGDERP-233 (OP1): strict FREEZE enforcement.
 * Throws when an active FREEZE opname session covers the warehouse.
 * Call from every outlet-stock mutation (sales, returns, transfers,
 * stock-in/out, adjustments, service parts usage). The opname approval
 * posting itself never calls this — it is the only allowed writer.
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
