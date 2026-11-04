import { ServiceOrdersService } from './service-orders.service';

const KEY = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const baseDto = (over: Record<string, any> = {}) => ({
  customerName: 'Walk-in One',
  customerPhone: '081234567890',
  deviceType: 'handphone',
  deviceUnit: 'Samsung A54',
  complaint: 'Mati total',
  warehouseId: 'wh-1',
  clientMutationId: KEY,
  ...over,
});

function harness() {
  const tx = {
    serviceOrder: { create: jest.fn(), findUnique: jest.fn() },
    serviceStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    servicePartsUsed: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  const prisma = {
    serviceOrder: { findUnique: jest.fn() },
    customer: { findUnique: jest.fn() },
    deviceType: { findFirst: jest.fn().mockResolvedValue({ code: 'handphone' }) },
    warehouse: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'wh-1', isActive: true, type: 'GOOD', scope: 'OUTLET', outletId: 'br-1' }),
    },
    $transaction: jest.fn((cb: (client: typeof tx) => unknown) => cb(tx)),
  };
  const service = new ServiceOrdersService(prisma as any, {} as any, {} as any);
  return { service, prisma, tx };
}

describe('ServiceOrdersService.create idempotency (IGDERP-240)', () => {
  it('returns the original order on replay without creating', async () => {
    const { service, prisma, tx } = harness();
    prisma.serviceOrder.findUnique.mockResolvedValue({ id: 'so-orig' });
    const detail = { id: 'so-orig', serviceNumber: 'SRV-X' };
    jest.spyOn(service, 'findById').mockResolvedValue(detail as any);

    const out = await service.create(baseDto() as any, 'user-1', 'br-1');

    expect(out).toBe(detail);
    expect(tx.serviceOrder.create).not.toHaveBeenCalled();
    expect(prisma.warehouse.findUnique).not.toHaveBeenCalled();
  });

  it('stores clientMutationId on fresh create', async () => {
    const { service, prisma, tx } = harness();
    prisma.serviceOrder.findUnique.mockResolvedValue(null);
    tx.serviceOrder.create.mockResolvedValue({ id: 'so-new', status: 'pending' });

    await service.create(baseDto() as any, 'user-1', 'br-1');

    expect(tx.serviceOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clientMutationId: KEY }),
      }),
    );
    expect(tx.serviceStatusHistory.create).toHaveBeenCalledTimes(1);
  });

  it('P2002 race returns the winner without side effects', async () => {
    const { service, prisma, tx } = harness();
    prisma.serviceOrder.findUnique.mockResolvedValue(null);
    tx.serviceOrder.create.mockRejectedValue({ code: 'P2002' });
    tx.serviceOrder.findUnique.mockResolvedValue({ id: 'so-winner' });
    const detail = { id: 'so-winner', serviceNumber: 'SRV-W' };
    jest.spyOn(service, 'findById').mockResolvedValue(detail as any);

    const out = await service.create(baseDto() as any, 'user-1', 'br-1');

    expect(out).toBe(detail);
    expect(tx.serviceStatusHistory.create).not.toHaveBeenCalled();
    expect(tx.servicePartsUsed.createMany).not.toHaveBeenCalled();
  });

  it('no key means legacy behavior (no dedupe lookup)', async () => {
    const { service, prisma, tx } = harness();
    tx.serviceOrder.create.mockResolvedValue({ id: 'so-legacy', status: 'pending' });

    const { clientMutationId: _drop, ...legacy } = baseDto();
    await service.create(legacy as any, 'user-1', 'br-1');

    expect(prisma.serviceOrder.findUnique).not.toHaveBeenCalled();
    expect(tx.serviceOrder.create).toHaveBeenCalled();
  });
});
