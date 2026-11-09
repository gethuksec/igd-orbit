import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { PenaltyTypesService } from './penalty-types.service';
import { ConflictException } from '@nestjs/common';

function mockDelegate() {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
}

async function boot(ServiceClass: any, delegateName: string, extra: Record<string, any> = {}) {
  const delegates: Record<string, any> = { [delegateName]: mockDelegate(), ...extra };
  const module: TestingModule = await Test.createTestingModule({
    providers: [ServiceClass, { provide: PrismaService, useValue: delegates }],
  }).compile();
  return { service: module.get(ServiceClass), prisma: delegates };
}

describe('PenaltyTypesService (IGDERP-261)', () => {
  it('creates with percent-tier calculation + tiers config', async () => {
    const { service, prisma }: any = await boot(PenaltyTypesService, 'penaltyType');
    prisma.penaltyType.findUnique.mockResolvedValue(null);
    prisma.penaltyType.findFirst.mockResolvedValue(null);
    prisma.penaltyType.create.mockImplementation(async ({ data }: any) => ({ id: 'p-1', ...data }));
    const res: any = await service.create({
      name: 'Denda Pulang Cepat',
      calculation: 'percent-tier',
      tiers: [{ min: 25, max: 100 }],
      priority: 5,
    });
    expect(res.code).toMatch(/^DENDA-[0-9A-F]{8}$/);
    expect(res.calculation).toBe('percent-tier');
    expect(res.tiers).toEqual([{ min: 25, max: 100 }]);
  });

  it('defaults calculation to fixed', async () => {
    const { service, prisma }: any = await boot(PenaltyTypesService, 'penaltyType');
    prisma.penaltyType.findUnique.mockResolvedValue(null);
    prisma.penaltyType.findFirst.mockResolvedValue(null);
    prisma.penaltyType.create.mockImplementation(async ({ data }: any) => ({ id: 'p-2', ...data }));
    const res: any = await service.create({ code: 'DENDA-X', name: 'X' });
    expect(res.calculation).toBe('fixed');
  });

  it('rejects duplicate code', async () => {
    const { service, prisma }: any = await boot(PenaltyTypesService, 'penaltyType');
    prisma.penaltyType.findUnique.mockResolvedValue({ id: 'dup' });
    await expect(service.create({ code: 'DENDA-A', name: 'A' } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('soft-deletes with audit timestamp', async () => {
    const { service, prisma }: any = await boot(PenaltyTypesService, 'penaltyType');
    prisma.penaltyType.findFirst.mockResolvedValue({ id: 'p-9', code: 'DENDA-X' });
    prisma.penaltyType.update.mockResolvedValue({});
    await service.delete('p-9');
    expect(prisma.penaltyType.update).toHaveBeenCalledWith({
      where: { id: 'p-9' },
      data: { isActive: false, deletedAt: expect.any(Date) },
    });
  });
});
