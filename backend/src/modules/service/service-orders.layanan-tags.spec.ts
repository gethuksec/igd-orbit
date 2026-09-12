import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceOrdersService } from './service-orders.service';

describe('ServiceOrdersService.updateLayananTags (IGDERP-137)', () => {
  let service: ServiceOrdersService;
  let prisma: any;

  const tx = {
    serviceOrderLayanan: { update: jest.fn() },
    serviceStatusHistory: { create: jest.fn() },
    serviceTag: { upsert: jest.fn() },
  };

  beforeEach(() => {
    prisma = {
      serviceOrder: { findUnique: jest.fn() },
      serviceOrderLayanan: { findFirst: jest.fn() },
      $transaction: jest.fn((fn: any) => fn(tx)),
    };
    service = new ServiceOrdersService(prisma, undefined, undefined);
    jest.clearAllMocks();
  });

  const readyOrder = { id: 'so-1', status: 'ready' };
  const row = { id: 'row-1', serviceOrderId: 'so-1', name: 'Ganti LCD' };

  it('updates tags at Ready + feeds dictionary + logs history', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(readyOrder);
    prisma.serviceOrderLayanan.findFirst.mockResolvedValue(row);
    tx.serviceOrderLayanan.update.mockImplementation((args: any) =>
      Promise.resolve({ ...row, ...args.data }),
    );
    tx.serviceStatusHistory.create.mockResolvedValue({ id: 'h-1' });
    tx.serviceTag.upsert.mockResolvedValue({});

    const out: any = await service.updateLayananTags('so-1', 'row-1', 'Lcd, Baterai', 'tc-1');

    expect(out.notes).toBe('Lcd, Baterai');
    expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ready',
          notes: expect.stringContaining('Tag layanan Ganti LCD'),
        }),
      }),
    );
    expect(tx.serviceTag.upsert).toHaveBeenCalledTimes(2);
  });

  it('rejects outside Ready (in-progress, done)', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue({ id: 'so-1', status: 'in-progress' });
    await expect(service.updateLayananTags('so-1', 'row-1', 'Lcd', 'u')).rejects.toThrow(
      BadRequestException,
    );

    prisma.serviceOrder.findUnique.mockResolvedValue({ id: 'so-1', status: 'done' });
    await expect(service.updateLayananTags('so-1', 'row-1', 'Lcd', 'u')).rejects.toThrow(
      BadRequestException,
    );
    expect(tx.serviceOrderLayanan.update).not.toHaveBeenCalled();
  });

  it('rejects unknown row (NotFound)', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(readyOrder);
    prisma.serviceOrderLayanan.findFirst.mockResolvedValue(null);
    await expect(service.updateLayananTags('so-1', 'nope', 'Lcd', 'u')).rejects.toThrow(
      NotFoundException,
    );
  });
});
