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
      assignedTechnicianId: 'tech-1',
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

  it('round 5: normalizeTag/splitTags collapse casing; recordTagUsage upserts UpperFirst', async () => {
    expect(ServiceOrdersService.normalizeTag('  LCD   retak ')).toBe('Lcd retak');
    expect(ServiceOrdersService.splitTags('lcd, LCD , Layar,')).toEqual(['Lcd', 'Layar']);
    const prisma = { serviceTag: { upsert: jest.fn().mockResolvedValue({}) } };
    const service = new ServiceOrdersService(prisma as any, {} as any, {} as any);
    await (service as any).recordTagUsage(['lcd', 'LCD', 'Layar retak']);
    expect(prisma.serviceTag.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.serviceTag.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { name: 'Lcd' } }));
    await expect((service as any).recordTagUsage(['x'.repeat(61)])).rejects.toThrow('Tag terlalu panjang');
  });

  it('round 5: suggestTags filters case-insensitively, usage-ranked, take clamped', async () => {
    const prisma = { serviceTag: { findMany: jest.fn().mockResolvedValue([{ name: 'Lcd', usageCount: 3 }]) } };
    const service = new ServiceOrdersService(prisma as any, {} as any, {} as any);
    await service.suggestTags('lc', 5);
    expect(prisma.serviceTag.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { name: { contains: 'lc', mode: 'insensitive' } },
      take: 5,
    }));
    await service.suggestTags('', 99);
    expect(prisma.serviceTag.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
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
      assignedTechnicianId: 'tech-1',
      deviceUnit: 'Xiaomi 17T',
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

  it('round 4: slaDue = received + queue SLA sum, mandatory tech/device, per-row cost+tag', async () => {
    const created: any[] = [];
    const tx = {
      serviceOrder: { create: jest.fn((args: any) => { created.push(args); return Promise.resolve({ id: 'so-1', status: 'pending' }); }) },
      serviceStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      servicePartsUsed: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      customer: { findUnique: jest.fn() },
      serviceType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'st-1', slaHours: 24 }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'st-1', name: 'Interface', slaHours: 24, basePrice: 400000 },
          { id: 'st-2', name: 'Software', slaHours: 6, basePrice: 200000 },
        ]),
      },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      warehouse: { findUnique: jest.fn().mockResolvedValue({ id: 'wh-1', isActive: true, type: 'GOOD', scope: 'OUTLET', outletId: 'br-1' }) },
      serviceTag: { upsert: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ServiceOrdersService(prisma as any, {} as any, {} as any);
    const receivedDate = '2026-09-05T23:09:00.000Z';
    const dto: any = {
      branchId: 'br-1', customerName: 'Budi', customerPhone: '081234567890',
      deviceType: 'handphone', deviceUnit: 'Xiaomi 17T', complaint: 'bagus',
      serviceSubType: 'quick', assignedTechnicianId: 'tech-1',
      layananIds: ['st-1', 'st-2'],
      layananItems: [
        { serviceTypeId: 'st-1', estimatedCost: 100000, notes: 'LCD retak' },
        { serviceTypeId: 'st-2', estimatedCost: 200000, notes: 'Bootloop' },
      ],
      finalPrice: 300000, receivedDate, warehouseId: 'wh-1',
      taxPpn: false, taxIncPpn: false, taxPph22: false, taxPph23: false,
    };
    await service.create(dto, 'user-1', 'br-1');
    // queue: received + (24+6)h
    expect(created[0].data.slaDueDate).toEqual(new Date(new Date(receivedDate).getTime() + 30 * 3600 * 1000));
    // per-row cost + tag persisted (master basePrice ditched)
    expect(created[0].data.layanan.create).toEqual([
      expect.objectContaining({ serviceTypeId: 'st-1', estimatedCost: 100000, notes: 'LCD retak' }),
      expect.objectContaining({ serviceTypeId: 'st-2', estimatedCost: 200000, notes: 'Bootloop' }),
    ]);

    const { assignedTechnicianId, ...noTech } = dto;
    await expect(service.create(noTech, 'user-1', 'br-1')).rejects.toThrow('Teknisi wajib dipilih');
    const { deviceUnit, ...noUnit } = dto;
    await expect(service.create(noUnit, 'user-1', 'br-1')).rejects.toThrow('Nama Barang wajib diisi');
  });
});
