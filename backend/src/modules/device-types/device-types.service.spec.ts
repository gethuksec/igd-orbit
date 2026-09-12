import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeviceTypesService } from './device-types.service';

describe('DeviceTypesService (IGDERP-169)', () => {
  let service: DeviceTypesService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      deviceType: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      serviceOrder: { count: jest.fn() },
    };
    service = new DeviceTypesService(prisma);
    jest.clearAllMocks();
  });

  it('findActive returns active types ordered', async () => {
    prisma.deviceType.findMany.mockResolvedValue([{ code: 'handphone' }]);
    const out = await service.findActive();
    expect(prisma.deviceType.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
    expect(out).toEqual([{ code: 'handphone' }]);
  });

  it('create derives code from name and rejects duplicates', async () => {
    prisma.deviceType.findFirst.mockResolvedValue(null);
    prisma.deviceType.create.mockImplementation((args: any) => Promise.resolve({ id: 'dt-1', ...args.data }));

    const out: any = await service.create({ name: 'Smart TV' } as any);
    expect(out.code).toBe('smart-tv');

    prisma.deviceType.findFirst.mockResolvedValue({ id: 'dt-x' });
    await expect(service.create({ name: 'Smart TV' } as any)).rejects.toThrow(BadRequestException);
  });

  it('delete blocked when used by service orders', async () => {
    prisma.deviceType.findUnique.mockResolvedValue({ id: 'dt-1', code: 'handphone' });
    prisma.serviceOrder.count.mockResolvedValue(3);
    await expect(service.delete('dt-1')).rejects.toThrow(/dipakai 3 service order/);

    prisma.serviceOrder.count.mockResolvedValue(0);
    prisma.deviceType.delete.mockResolvedValue({ id: 'dt-1' });
    await service.delete('dt-1');
    expect(prisma.deviceType.delete).toHaveBeenCalledWith({ where: { id: 'dt-1' } });
  });

  it('findById throws NotFound for missing id', async () => {
    prisma.deviceType.findUnique.mockResolvedValue(null);
    await expect(service.findById('nope')).rejects.toThrow(NotFoundException);
  });
});
