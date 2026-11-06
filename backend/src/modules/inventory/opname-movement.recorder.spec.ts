import { recordOpenOpnameMovements } from './opname-movement.recorder';

describe('recordOpenOpnameMovements (IGDERP-235)', () => {
  const prisma = () => ({
    stockOpname: { findMany: jest.fn() },
    opnameMovement: { createMany: jest.fn() },
  });

  it('writes one row per OPEN session covering the warehouse', async () => {
    const p = prisma();
    p.stockOpname.findMany.mockResolvedValue([
      { id: 'op-1', warehouseId: 'wh-1' },
      { id: 'op-2', warehouseId: 'wh-1' },
    ]);

    await recordOpenOpnameMovements(p, [
      {
        warehouseId: 'wh-1',
        productId: 'prod-1',
        quantityChange: -2,
        movementType: 'SOLD',
        referenceType: 'SALE',
        referenceId: 'TRX-1',
        createdBy: 'cashier-1',
      },
    ]);

    expect(p.stockOpname.findMany).toHaveBeenCalledWith({
      where: {
        warehouseId: { in: ['wh-1'] },
        opnameType: 'OPEN',
        status: { in: ['draft', 'counting', 'completed'] },
      },
      select: { id: true, warehouseId: true },
    });
    expect(p.opnameMovement.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ opnameId: 'op-1', productId: 'prod-1', quantityChange: -2, movementType: 'SOLD' }),
        expect.objectContaining({ opnameId: 'op-2', productId: 'prod-1', quantityChange: -2, movementType: 'SOLD' }),
      ],
    });
  });

  it('scopes rows per warehouse when several move at once', async () => {
    const p = prisma();
    p.stockOpname.findMany.mockResolvedValue([{ id: 'op-9', warehouseId: 'wh-9' }]);

    await recordOpenOpnameMovements(p, [
      { warehouseId: 'wh-9', productId: 'a', quantityChange: 5, movementType: 'INBOUND' },
      { warehouseId: 'wh-other', productId: 'b', quantityChange: 1, movementType: 'INBOUND' },
    ]);

    expect(p.opnameMovement.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ opnameId: 'op-9', productId: 'a' })],
    });
  });

  it('writes nothing when no OPEN session runs (or nothing moved)', async () => {
    const p = prisma();
    p.stockOpname.findMany.mockResolvedValue([]);

    await recordOpenOpnameMovements(p, [
      { warehouseId: 'wh-1', productId: 'prod-1', quantityChange: -1, movementType: 'SOLD' },
    ]);
    expect(p.opnameMovement.createMany).not.toHaveBeenCalled();

    const p2 = prisma();
    await recordOpenOpnameMovements(p2, [
      { warehouseId: 'wh-1', productId: 'prod-1', quantityChange: 0, movementType: 'SOLD' },
    ]);
    expect(p2.stockOpname.findMany).not.toHaveBeenCalled();
  });
});
