/**
 * IGDERP-235 (OP3): movement capture for OPEN opname sessions.
 *
 * While an OPEN session runs on an outlet warehouse, every inventory
 * mutation records a signed movement row so the review can compute
 * Expected = Snapshot + Σ movements. FREEZE sessions never reach here —
 * the freeze guard blocks them first.
 *
 * Call with the same prisma/tx client the stock write uses so the log row
 * commits atomically with the mutation itself.
 */
export type OpenMovementEntry = {
  warehouseId: string;
  productId: string;
  /** Signed delta on quantityAvailable (sales negative, inbound positive). */
  quantityChange: number;
  movementType: 'SOLD' | 'RETURN' | 'INBOUND' | 'TRANSFER' | 'ADJUSTMENT';
  referenceType?: string;
  referenceId?: string;
  createdBy?: string;
};

/** Minimal prisma surface the recorder needs (PrismaService or tx client). */
export type MovementRecorderPrisma = {
  stockOpname: { findMany: (args: any) => Promise<any[]> };
  opnameMovement: { createMany: (args: any) => Promise<any> };
};

/** Statuses during which an OPEN session keeps capturing movements. */
export const OPEN_CAPTURE_STATUSES = ['draft', 'counting', 'completed'];

export async function recordOpenOpnameMovements(
  prisma: MovementRecorderPrisma,
  entries: OpenMovementEntry[],
): Promise<void> {
  const valid = (entries ?? []).filter((e) => e && e.warehouseId && e.productId && e.quantityChange !== 0);
  if (valid.length === 0) return;
  // Feature-detect the delegates: unit-test doubles and partial clients
  // skip logging instead of crashing the host mutation (audit must never
  // break a sale). Real tx/Prisma clients always carry both delegates.
  const txAny = prisma as any;
  if (!txAny?.stockOpname?.findMany || !txAny?.opnameMovement?.createMany) return;

  const warehouseIds = [...new Set(valid.map((e) => e.warehouseId))];
  const sessions = await prisma.stockOpname.findMany({
    where: {
      warehouseId: { in: warehouseIds },
      opnameType: 'OPEN',
      status: { in: OPEN_CAPTURE_STATUSES },
    },
    select: { id: true, warehouseId: true },
  });
  if (sessions.length === 0) return;

  const byWarehouse = new Map<string, string[]>();
  for (const s of sessions) {
    const list = byWarehouse.get(s.warehouseId) ?? [];
    list.push(s.id);
    byWarehouse.set(s.warehouseId, list);
  }

  const rows: any[] = [];
  for (const e of valid) {
    for (const opnameId of byWarehouse.get(e.warehouseId) ?? []) {
      rows.push({
        opnameId,
        productId: e.productId,
        movementType: e.movementType,
        quantityChange: e.quantityChange,
        referenceType: e.referenceType ?? null,
        referenceId: e.referenceId ?? null,
        createdBy: e.createdBy ?? null,
      });
    }
  }
  if (rows.length > 0) {
    await prisma.opnameMovement.createMany({ data: rows });
  }
}
