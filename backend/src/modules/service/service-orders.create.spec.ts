import { ServiceOrdersService } from './service-orders.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('ServiceOrdersService.create — Smart Repair v9 payload', () => {
  it('persists received datetime, device color, and part warranty days', async () => {
    const tx = {
      serviceOrder: {
        create: jest.fn().mockResolvedValue({ id: 'so-1', status: 'pending' }),
      },
      serviceStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      servicePartsUsed: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      customer: { findUnique: jest.fn() },
      serviceType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'st-1', slaHours: 24 }),
        findMany: jest.fn().mockResolvedValue([{ id: 'st-1', name: 'Ganti LCD', slaHours: 24, basePrice: 950000 }]),
      },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'prod-1', costPrice: new Decimal(100000) }]) },
      warehouse: { findUnique: jest.fn().mockResolvedValue({ id: 'wh-1', isActive: true, type: 'GOOD', scope: 'OUTLET', outletId: 'br-1' }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ServiceOrdersService(prisma as any, {} as any, {} as any);
    const receivedDate = '2026-09-05T09:12:00.000Z';

    await service.create({
      branchId: 'br-1',
      customerName: 'Budi Santoso',
      customerPhone: '081234567890',
      deviceType: 'handphone',
      deviceUnit: 'Samsung A54',
      deviceColor: 'Coklat',
      deviceSerial: 'SN-1',
      deviceCondition: 'Layar retak',
      complaint: 'Layar retak',
      serviceSubType: 'quick',
      layananIds: ['st-1'],
      finalPrice: 1100000,
      receivedDate,
      warrantyDays: 90,
      warehouseId: 'wh-1',
      taxPpn: false,
      taxIncPpn: false,
      taxPph22: false,
      taxPph23: false,
      parts: [{ productId: 'prod-1', quantity: 1, unitPrice: 150000, warrantyDays: 90 }],
    } as any, 'user-1', 'br-1');

    expect(tx.serviceOrder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        receivedDate: new Date(receivedDate),
        deviceColor: 'Coklat',
        warrantyDays: 90,
      }),
    }));
    expect(tx.servicePartsUsed.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ warrantyDays: 90 })],
    });
  });

  it('persists per-part warehouse and rejects a foreign-outlet warehouse', async () => {
    const tx = {
      serviceOrder: {
        create: jest.fn().mockResolvedValue({ id: 'so-1', status: 'pending' }),
      },
      serviceStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      servicePartsUsed: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      customer: { findUnique: jest.fn() },
      serviceType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'st-1', slaHours: 24 }),
        findMany: jest.fn().mockResolvedValue([{ id: 'st-1', name: 'Ganti LCD', slaHours: 24, basePrice: 950000 }]),
      },
      product: { findMany: jest.fn().mockResolvedValue([{ id: 'prod-1', costPrice: new Decimal(100000) }]) },
      warehouse: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (where.id === 'wh-1') return { id: 'wh-1', isActive: true, type: 'GOOD', scope: 'OUTLET', outletId: 'br-1' };
          if (where.id === 'wh-2') return { id: 'wh-2', isActive: true, type: 'GOOD', scope: 'OUTLET', outletId: 'br-1' };
          return { id: where.id, isActive: true, type: 'GOOD', scope: 'OUTLET', outletId: 'br-OTHER' };
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ServiceOrdersService(prisma as any, {} as any, {} as any);
    const base: any = {
      branchId: 'br-1',
      customerName: 'Budi Santoso',
      customerPhone: '081234567890',
      deviceType: 'handphone',
      complaint: 'Layar retak',
      serviceSubType: 'quick',
      finalPrice: 1100000,
      warehouseId: 'wh-1',
      taxPpn: false,
      taxIncPpn: false,
      taxPph22: false,
      taxPph23: false,
    };

    await service.create({ ...base, parts: [{ productId: 'prod-1', quantity: 1, unitPrice: 150000, warehouseId: 'wh-2' }] }, 'user-1', 'br-1');
    expect(tx.servicePartsUsed.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ warehouseId: 'wh-2' })],
    });

    await expect(
      service.create({ ...base, parts: [{ productId: 'prod-1', quantity: 1, unitPrice: 150000, warehouseId: 'wh-X' }] }, 'user-1', 'br-1'),
    ).rejects.toThrow('Part warehouse must be an active GOOD warehouse of the same outlet');
  });
});
