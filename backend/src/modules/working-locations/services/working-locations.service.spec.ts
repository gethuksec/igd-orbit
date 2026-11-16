import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { WorkingLocationsService } from './working-locations.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

function mockDelegate() {
  return {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
}

async function boot() {
  const delegates = { workingLocation: mockDelegate(), branch: mockDelegate() };
  const module: TestingModule = await Test.createTestingModule({
    providers: [WorkingLocationsService, { provide: PrismaService, useValue: delegates }],
  }).compile();
  return { service: module.get(WorkingLocationsService), prisma: delegates };
}

describe('WorkingLocationsService (IGDERP-270)', () => {
  it('creates with code and optional branch link', async () => {
    const { service, prisma }: any = await boot();
    prisma.workingLocation.findUnique.mockResolvedValue(null);
    prisma.branch.findUnique.mockResolvedValue({ id: 'b1', isActive: true });
    prisma.workingLocation.create.mockImplementation(async ({ data }: any) => ({ id: 'wl-1', ...data }));
    const res: any = await service.create({
      code: 'HQ-JBR',
      name: 'HQ Jember',
      branchId: 'b1',
      latitude: -8.1845,
      longitude: 113.6687,
      radiusM: 100,
    });
    expect(res.code).toBe('HQ-JBR');
    expect(res.branchId).toBe('b1');
  });

  it('creates HQ-style rows with no branch link', async () => {
    const { service, prisma }: any = await boot();
    prisma.workingLocation.findUnique.mockResolvedValue(null);
    prisma.workingLocation.create.mockImplementation(async ({ data }: any) => ({ id: 'wl-2', ...data }));
    const res: any = await service.create({ code: 'HQ-X', name: 'HQ X' });
    expect(res.branchId).toBeNull();
  });

  it('auto-generates a code when omitted', async () => {
    const { service, prisma }: any = await boot();
    prisma.workingLocation.findUnique.mockResolvedValue(null);
    prisma.workingLocation.create.mockImplementation(async ({ data }: any) => ({ id: 'wl-3', ...data }));
    const res: any = await service.create({ name: 'Baru' });
    expect(res.code).toMatch(/^WL-[0-9A-F]{6}$/);
  });

  it('rejects duplicate code', async () => {
    const { service, prisma }: any = await boot();
    prisma.workingLocation.findUnique.mockResolvedValue({ id: 'dup' });
    await expect(service.create({ code: 'HQ-JBR', name: 'X' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects missing or inactive branch link', async () => {
    const { service, prisma }: any = await boot();
    prisma.workingLocation.findUnique.mockResolvedValue(null);
    prisma.branch.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ code: 'X', name: 'X', branchId: 'nope' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft-deletes on remove', async () => {
    const { service, prisma }: any = await boot();
    prisma.workingLocation.findUnique.mockResolvedValue({ id: 'wl-1' });
    await service.remove('wl-1');
    expect(prisma.workingLocation.update).toHaveBeenCalledWith({
      where: { id: 'wl-1' },
      data: { isActive: false },
    });
  });

  it('throws 404 for unknown location', async () => {
    const { service, prisma }: any = await boot();
    prisma.workingLocation.findUnique.mockResolvedValue(null);
    await expect(service.findById('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
