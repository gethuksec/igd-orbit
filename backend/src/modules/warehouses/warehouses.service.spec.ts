import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { WarehousesService } from './warehouses.service';

describe('WarehousesService warehouse identity invariants', () => {
  let service: WarehousesService;
  let prisma: {
    warehouse: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    branch: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      warehouse: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      branch: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehousesService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<WarehousesService>(WarehousesService);
  });

  it('rejects creating a second active system BAD warehouse', async () => {
    prisma.warehouse.findFirst.mockResolvedValue({
      id: 'central-bad-existing',
      type: 'BAD',
      scope: 'SYSTEM',
      outletId: null,
      isActive: true,
    });

    await expect(
      service.create({
        name: 'Another Bad Stock',
        type: 'BAD',
        scope: 'SYSTEM',
        outletId: null,
      } as any),
    ).rejects.toThrow(ConflictException);

    expect(prisma.warehouse.create).not.toHaveBeenCalled();
  });

  it('rejects deactivating the active Central Bad Stock warehouse', async () => {
    prisma.warehouse.findUnique.mockResolvedValue({
      id: 'central-bad',
      type: 'BAD',
      scope: 'SYSTEM',
      outletId: null,
      isActive: true,
      name: 'Central Bad Stock',
      code: 'BAD-SYSTEM',
    });

    await expect(
      service.update('central-bad', { isActive: false } as any),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.warehouse.update).not.toHaveBeenCalled();
  });

  it('excludes system warehouses from normal active selectors', async () => {
    prisma.warehouse.findMany.mockResolvedValue([]);

    await service.findActive();

    expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, scope: 'OUTLET' },
      }),
    );
  });
});
