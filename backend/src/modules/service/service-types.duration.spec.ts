import { Decimal } from '@prisma/client/runtime/library';
import { ServiceTypesService } from './service-types.service';

describe('ServiceTypesService durationHours (IGDERP-186)', () => {
  let service: ServiceTypesService;
  let prisma: {
    serviceType: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  const row = (over: Record<string, any> = {}) => ({
    id: 'st-1',
    code: 'SCREEN_REPLACE_HP',
    name: 'Screen Replacement (HP)',
    description: null,
    basePrice: new Decimal(300000),
    minPrice: new Decimal(150000),
    maxPrice: new Decimal(500000),
    slaHours: new Decimal(4),
    durationHours: new Decimal(2),
    isActive: true,
    _count: { serviceOrders: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  beforeEach(() => {
    prisma = {
      serviceType: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new ServiceTypesService(prisma as any);
    jest.clearAllMocks();
  });

  it('create passes durationHours through and returns it as a number', async () => {
    prisma.serviceType.findFirst.mockResolvedValue(null); // name unique
    prisma.serviceType.create.mockImplementation(() => Promise.resolve(row()));
    const out: any = await service.create({ code: 'X', name: 'X', basePrice: 1, slaHours: 4, durationHours: 2 } as any);
    expect(prisma.serviceType.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ durationHours: 2 }) }),
    );
    expect(out.durationHours).toBe(2);
  });

  it('create stores null when durationHours is omitted', async () => {
    prisma.serviceType.findFirst.mockResolvedValue(null);
    prisma.serviceType.create.mockImplementation(() =>
      Promise.resolve(row({ durationHours: null })),
    );
    const out: any = await service.create({ code: 'X', name: 'X', basePrice: 1, slaHours: 4 } as any);
    expect(prisma.serviceType.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ durationHours: null }) }),
    );
    expect(out.durationHours).toBeNull();
  });

  it('update persists durationHours and returns it as a number', async () => {
    prisma.serviceType.findFirst.mockResolvedValue(row({ durationHours: null }));
    prisma.serviceType.update.mockImplementation(() =>
      Promise.resolve(row({ durationHours: new Decimal(1.5) })),
    );
    const out: any = await service.update('st-1', { durationHours: 1.5 } as any);
    expect(prisma.serviceType.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ durationHours: 1.5 }) }),
    );
    expect(out.durationHours).toBe(1.5);
  });

  it('findAll maps durationHours Decimal to number (null-safe)', async () => {
    prisma.serviceType.findMany.mockResolvedValue([
      row(),
      row({ id: 'st-2', durationHours: null }),
    ]);
    const out: any[] = await service.findAll({});
    expect(out[0].durationHours).toBe(2);
    expect(out[1].durationHours).toBeNull();
  });
});
