import { ServiceOrdersService } from './service-orders.service';

describe('ServiceOrdersService detail round — internalNotes, removeLayanan', () => {
  it('create persists internalNotes and uses it as Receive history note', async () => {
    const tx = {
      serviceOrder: {
        create: jest.fn().mockResolvedValue({ id: 'so-1', status: 'pending' }),
      },
      serviceStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      servicePartsUsed: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      customer: { findUnique: jest.fn() },
      deviceType: { findFirst: jest.fn().mockResolvedValue({ code: 'handphone' }) },
      serviceType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'st-1', slaHours: 24 }),
        findMany: jest.fn().mockResolvedValue([{ id: 'st-1', name: 'Ganti LCD', slaHours: 24, basePrice: 950000 }]),
      },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      warehouse: { findUnique: jest.fn().mockResolvedValue({ id: 'wh-1', isActive: true, type: 'GOOD', scope: 'OUTLET', outletId: 'br-1' }) },
      serviceTag: { upsert: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ServiceOrdersService(prisma as any, {} as any, {} as any);
    await service.create({
      branchId: 'br-1', customerName: 'Budi', customerPhone: '081234567890',
      deviceType: 'handphone', deviceUnit: 'Xiaomi 17T', complaint: 'bagus',
      serviceSubType: 'quick', assignedTechnicianId: 'tech-1',
      layananIds: ['st-1'], finalPrice: 950000, warehouseId: 'wh-1',
      internalNotes: 'Minta ganti ori',
      taxPpn: false, taxIncPpn: false, taxPph22: false, taxPph23: false,
    } as any, 'user-1', 'br-1');
    expect(tx.serviceOrder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ internalNotes: 'Minta ganti ori' }),
    }));
    expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'pending', notes: 'Minta ganti ori' }),
    }));
  });

  it('create falls back to legacy history note when internalNotes empty', async () => {
    const tx = {
      serviceOrder: { create: jest.fn().mockResolvedValue({ id: 'so-1', status: 'pending' }) },
      serviceStatusHistory: { create: jest.fn().mockResolvedValue({}) },
      servicePartsUsed: { createMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const prisma = {
      customer: { findUnique: jest.fn() },
      deviceType: { findFirst: jest.fn().mockResolvedValue({ code: 'handphone' }) },
      serviceType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'st-1', slaHours: 24 }),
        findMany: jest.fn().mockResolvedValue([{ id: 'st-1', name: 'Ganti LCD', slaHours: 24, basePrice: 950000 }]),
      },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      warehouse: { findUnique: jest.fn().mockResolvedValue({ id: 'wh-1', isActive: true, type: 'GOOD', scope: 'OUTLET', outletId: 'br-1' }) },
      serviceTag: { upsert: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ServiceOrdersService(prisma as any, {} as any, {} as any);
    await service.create({
      branchId: 'br-1', customerName: 'Budi', customerPhone: '081234567890',
      deviceType: 'handphone', deviceUnit: 'Xiaomi 17T', complaint: 'bagus',
      serviceSubType: 'quick', assignedTechnicianId: 'tech-1',
      layananIds: ['st-1'], finalPrice: 950000, warehouseId: 'wh-1',
      taxPpn: false, taxIncPpn: false, taxPph22: false, taxPph23: false,
    } as any, 'user-1', 'br-1');
    expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ notes: 'Service order created' }),
    }));
  });

  const mockRemove = (status: string, layanan: any[]) => {
    const tx = {
      serviceOrderLayanan: { delete: jest.fn().mockResolvedValue({}) },
      serviceStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      serviceOrder: { findUnique: jest.fn().mockResolvedValue({ id: 'so-1', status, layanan }) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    return { tx, prisma, service: new ServiceOrdersService(prisma as any, {} as any, {} as any) };
  };

  it('removeLayanan deletes row and logs audit history', async () => {
    const rows = [
      { id: 'r1', name: 'Ganti LCD', estimatedCost: 950000 },
      { id: 'r2', name: 'Flash', estimatedCost: 75000 },
    ];
    const { tx, service } = mockRemove('in-progress', rows);
    const res = await service.removeLayanan('so-1', 'r2', 'user-1');
    expect(tx.serviceOrderLayanan.delete).toHaveBeenCalledWith({ where: { id: 'r2' } });
    expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'in-progress', notes: expect.stringContaining('Hapus Layanan: Flash') }),
    }));
    expect(res).toEqual({ id: 'r2', name: 'Flash' });
  });

  it('removeLayanan refuses frozen statuses, unknown row, and last row', async () => {
    const rows = [{ id: 'r1', name: 'Ganti LCD', estimatedCost: 950000 }];
    await expect(mockRemove('done', rows).service.removeLayanan('so-1', 'r1', 'u')).rejects.toThrow(
      'Cannot remove layanan from service order with status: done',
    );
    await expect(mockRemove('in-progress', rows).service.removeLayanan('so-1', 'nope', 'u')).rejects.toThrow(
      'Layanan tidak ditemukan pada service order ini',
    );
    await expect(mockRemove('in-progress', rows).service.removeLayanan('so-1', 'r1', 'u')).rejects.toThrow(
      'Minimal satu layanan wajib ada',
    );
  });

  it('uploadPhotoFiles rejects bad type/stage without touching disk', async () => {
    const prisma = {
      serviceOrder: { findUnique: jest.fn().mockResolvedValue({ id: 'so-1', status: 'in-progress' }) },
    };
    const service = new ServiceOrdersService(prisma as any, {} as any, {} as any);
    const file = { originalname: 'a.jpg', mimetype: 'image/jpeg', size: 100, buffer: Buffer.from('x') };
    await expect(service.uploadPhotoFiles('so-1', [file], 'bongkar', undefined, 'u')).rejects.toThrow(
      'photoType wajib salah satu',
    );
    await expect(
      service.uploadPhotoFiles('so-1', [{ ...file, mimetype: 'application/pdf' }], 'repair', undefined, 'u'),
    ).rejects.toThrow('File wajib gambar');
    await expect(
      service.uploadPhotoFiles('so-1', [{ ...file, size: 2 * 1024 * 1024 }], 'repair', undefined, 'u'),
    ).rejects.toThrow('Maksimal 1MB');
  });

  it('addTime note uses DD MMM YYYY HH:mm WIB (UTC+7 eksplisit)', async () => {
    const created: any[] = [];
    const tx = {
      serviceOrder: { update: jest.fn().mockResolvedValue({ id: 'so-1' }) },
      serviceStatusHistory: { create: jest.fn((args: any) => { created.push(args.data); return Promise.resolve(args.data); }) },
    };
    const prisma = {
      serviceOrder: { findUnique: jest.fn().mockResolvedValue({ id: 'so-1', status: 'in-progress', slaDueDate: null }) },
      serviceType: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ServiceOrdersService(prisma as any, {} as any, {} as any);
    await service.addTime('so-1', { newEstimatedAt: '2026-09-07T16:38:00.000Z', notes: 'tunggu part' } as any, 'u');
    const note = created[0]?.notes || '';
    expect(note).not.toContain('T16:38');
    expect(note).toMatch(/Estimasi baru: \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}/);
    // 16:38 UTC = 23:38 WIB di hari yang sama
    expect(note).toContain('07 Sep 2026 23:38');
  });

  it('cancel restores part stock to source gudang + logs reason', async () => {
    const created: any[] = [];
    const movements: any[] = [];
    let stockQty = 10;
    const tx = {
      serviceOrder: { update: jest.fn().mockResolvedValue({ id: 'so-1' }) },
      serviceStatusHistory: { create: jest.fn((args: any) => { created.push(args.data); return Promise.resolve(args.data); }) },
      productStock: {
        findUnique: jest.fn().mockResolvedValue({ quantityAvailable: new (require('@prisma/client/runtime/library').Decimal)(10) }),
        update: jest.fn((args: any) => { stockQty = Number(args.data.quantityAvailable); return Promise.resolve({}); }),
      },
      stockMovement: { create: jest.fn((args: any) => { movements.push(args.data); return Promise.resolve(args.data); }) },
    };
    const prisma = {
      serviceOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'so-1', status: 'in-progress', serviceNumber: 'SVC-1', warehouseId: 'wh-0',
          partsUsed: [
            { productId: 'p-1', quantity: new (require('@prisma/client/runtime/library').Decimal)(2), warehouseId: 'wh-1', batchNumber: null, serialNumber: null, product: { name: 'LCD' } },
          ],
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ServiceOrdersService(prisma as any, {} as any, {} as any);
    await service.updateStatus('so-1', { status: 'cancelled', notes: 'pelanggan batal' } as any, 'u');
    expect(stockQty).toBe(12);
    expect(movements[0]).toEqual(expect.objectContaining({ movementType: 'IN', warehouseId: 'wh-1' }));
    expect(movements[0].notes).toContain('pelanggan batal');
    expect(created.some((h) => String(h.notes).includes('Stok kembali ke gudang') && String(h.notes).includes('LCD ×2'))).toBe(true);
  });

  it('processPayment accumulates DP: sisa lunas → paid + downPayment updated', async () => {
    const tx = {
      serviceOrder: { update: jest.fn().mockResolvedValue({ id: 'so-1', paymentStatus: 'paid' }) },
    };
    const prisma = {
      serviceOrder: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'so-1', status: 'ready', branchId: 'br-1',
          totalPrice: new (require('@prisma/client/runtime/library').Decimal)(1025000),
          downPayment: new (require('@prisma/client/runtime/library').Decimal)(500000),
          invoiceNumber: 'INV-1', paymentStatus: 'partial', paidAt: null, internalNotes: null,
        }),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new ServiceOrdersService(prisma as any, {} as any, {} as any);
    await service.processPayment('so-1', { paymentMethod: 'cash', amount: 525000 } as any, 'user-1');
    expect(tx.serviceOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ paymentStatus: 'paid' }),
    }));
    const data = tx.serviceOrder.update.mock.calls[0][0].data;
    expect(Number(data.downPayment)).toBe(1025000);
    await expect(
      service.processPayment('so-1', { paymentMethod: 'cash', amount: 525001 } as any, 'user-1'),
    ).rejects.toThrow('remaining balance');
  });
});
