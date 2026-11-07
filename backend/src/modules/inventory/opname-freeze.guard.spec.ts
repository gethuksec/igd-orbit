import { BadRequestException } from '@nestjs/common';
import {
  assertNoFreezeOpname,
  FREEZE_BLOCKED_STATUSES,
} from './opname-freeze.guard';

function guardPrisma(opts: {
  outletId?: string | null;
  session?: any;
}) {
  return {
    warehouse: {
      findUnique: jest.fn().mockResolvedValue(
        opts.outletId === undefined
          ? null
          : opts.outletId === null
            ? { id: 'wh-x', outletId: null }
            : { id: 'wh-x', outletId: opts.outletId },
      ),
    },
    stockOpname: {
      findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
        if (
          opts.session &&
          where.branchId === opts.session.branchId &&
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
  branchId: 'outlet-A',
  opnameType: 'FREEZE',
  status: 'counting',
  ...over,
});

describe('assertNoFreezeOpname (outlet-wide)', () => {
  it('no-ops when no warehouse is given', async () => {
    const prisma = guardPrisma({ outletId: 'outlet-A', session: freezeSession() });
    await expect(assertNoFreezeOpname(prisma as any, null)).resolves.toBeUndefined();
    expect(prisma.warehouse.findUnique).not.toHaveBeenCalled();
  });

  it('no-ops for system warehouses with no outlet (e.g. Central BAD)', async () => {
    const prisma = guardPrisma({ outletId: null, session: freezeSession() });
    await expect(assertNoFreezeOpname(prisma as any, 'wh-bad')).resolves.toBeUndefined();
    expect(prisma.stockOpname.findFirst).not.toHaveBeenCalled();
  });

  it('blocks a sale from the SAME warehouse as the session', async () => {
    const prisma = guardPrisma({ outletId: 'outlet-A', session: freezeSession() });
    await expect(
      assertNoFreezeOpname(prisma as any, 'wh-session', 'complete a sale'),
    ).rejects.toThrow(BadRequestException);
  });

  it('blocks a sale from a SIBLING warehouse of the same outlet', async () => {
    const prisma = guardPrisma({ outletId: 'outlet-A', session: freezeSession() });
    await expect(
      assertNoFreezeOpname(prisma as any, 'wh-sibling', 'complete a sale'),
    ).rejects.toThrow(/frozen for opname OP-1/);
  });

  it('allows sales at a DIFFERENT outlet', async () => {
    const prisma = guardPrisma({ outletId: 'outlet-B', session: freezeSession() });
    await expect(
      assertNoFreezeOpname(prisma as any, 'wh-other'),
    ).resolves.toBeUndefined();
  });

  it('allows sales while the session is OPEN (not FREEZE)', async () => {
    const prisma = guardPrisma({
      outletId: 'outlet-A',
      session: freezeSession({ opnameType: 'OPEN' }),
    });
    await expect(
      assertNoFreezeOpname(prisma as any, 'wh-x'),
    ).resolves.toBeUndefined();
  });

  it('allows sales with no active session', async () => {
    const prisma = guardPrisma({ outletId: 'outlet-A' });
    await expect(
      assertNoFreezeOpname(prisma as any, 'wh-x'),
    ).resolves.toBeUndefined();
  });

  it('keeps blocking while counted-but-unapproved (completed)', async () => {
    const prisma = guardPrisma({
      outletId: 'outlet-A',
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
