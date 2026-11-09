import { BadRequestException } from '@nestjs/common';
import {
  assertNoFreezeOpname,
  FREEZE_BLOCKED_STATUSES,
} from './opname-freeze.guard';

function guardPrisma(opts: {
  warehouseId?: string;
  session?: any;
}) {
  return {
    warehouse: {
      findUnique: jest.fn(),
    },
    stockOpname: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        if (
          opts.session &&
          where.warehouseId === opts.session.warehouseId &&
          (!where.opnameType || where.opnameType === opts.session.opnameType) &&
          (!where.status?.in || where.status.in.includes(opts.session.status))
        ) {
          return opts.session;
        }
        return null;
      }),
    },
  };
}

const freezeSession = (over: any = {}) => ({
  opnameNumber: 'OP-1',
  code: 'CODE1',
  warehouseId: 'wh-x',
  opnameType: 'FREEZE',
  status: 'counting',
  ...over,
});

describe('assertNoFreezeOpname (per-warehouse, IGDERP-259)', () => {
  it('no-ops when no warehouse is given', async () => {
    const prisma = guardPrisma({ session: freezeSession() });
    await expect(assertNoFreezeOpname(prisma as any, null)).resolves.toBeUndefined();
    expect(prisma.stockOpname.findFirst).not.toHaveBeenCalled();
  });

  it('freezes the central SYSTEM warehouse too (IGDERP-259)', async () => {
    const prisma = guardPrisma({ warehouseId: 'wh-central', session: freezeSession({ warehouseId: 'wh-central' }) });
    await expect(
      assertNoFreezeOpname(prisma as any, 'wh-central', 'receive stock'),
    ).rejects.toThrow(/frozen for opname OP-1/);
  });

  it('blocks a move on the SAME warehouse as the session', async () => {
    const prisma = guardPrisma({ session: freezeSession() });
    await expect(
      assertNoFreezeOpname(prisma as any, 'wh-x', 'complete a sale'),
    ).rejects.toThrow(BadRequestException);
  });

  it('allows moves on a SIBLING warehouse of the same outlet (per-gudang)', async () => {
    const prisma = guardPrisma({ session: freezeSession() });
    await expect(
      assertNoFreezeOpname(prisma as any, 'wh-sibling'),
    ).resolves.toBeUndefined();
  });

  it('allows moves on a DIFFERENT warehouse', async () => {
    const prisma = guardPrisma({ warehouseId: 'wh-other', session: freezeSession() });
    await expect(
      assertNoFreezeOpname(prisma as any, 'wh-other'),
    ).resolves.toBeUndefined();
  });

  it('allows sales while the session is OPEN (not FREEZE)', async () => {
    const prisma = guardPrisma({
      session: freezeSession({ opnameType: 'OPEN' }),
    });
    await expect(
      assertNoFreezeOpname(prisma as any, 'wh-x'),
    ).resolves.toBeUndefined();
  });

  it('allows sales with no active session', async () => {
    const prisma = guardPrisma({});
    await expect(
      assertNoFreezeOpname(prisma as any, 'wh-x'),
    ).resolves.toBeUndefined();
  });

  it('keeps blocking while counted-but-unapproved (completed)', async () => {
    const prisma = guardPrisma({
      session: freezeSession({ status: 'completed' }),
    });
    await expect(
      assertNoFreezeOpname(prisma as any, 'wh-x', 'transfer stock'),
    ).rejects.toThrow(BadRequestException);
  });

  it('FREEZE_BLOCKED_STATUSES covers draft/counting/completed', () => {
    expect(FREEZE_BLOCKED_STATUSES).toEqual(
      expect.arrayContaining(['draft', 'counting', 'completed']),
    );
  });
});
