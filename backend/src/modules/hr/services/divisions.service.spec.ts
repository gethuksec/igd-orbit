import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { DivisionsService } from './divisions.service';
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
  const delegates = { division: mockDelegate(), department: mockDelegate() };
  const module: TestingModule = await Test.createTestingModule({
    providers: [DivisionsService, { provide: PrismaService, useValue: delegates }],
  }).compile();
  return { service: module.get(DivisionsService), prisma: delegates };
}

describe('DivisionsService (IGDERP-277)', () => {
  it('creates with an active department', async () => {
    const { service, prisma }: any = await boot();
    prisma.division.findUnique.mockResolvedValue(null);
    prisma.department.findUnique.mockResolvedValue({ id: 'd1', isActive: true });
    prisma.division.create.mockImplementation(async ({ data }: any) => ({ id: 'div-1', ...data }));
    const res: any = await service.create({ code: 'DIV-OPS-SE', name: 'Sales', departmentId: 'd1' });
    expect(res.code).toBe('DIV-OPS-SE');
    expect(res.departmentId).toBe('d1');
    expect(res.isActive).toBe(true);
  });

  it('auto-generates a code when omitted', async () => {
    const { service, prisma }: any = await boot();
    prisma.division.findUnique.mockResolvedValue(null);
    prisma.department.findUnique.mockResolvedValue({ id: 'd1', isActive: true });
    prisma.division.create.mockImplementation(async ({ data }: any) => ({ id: 'div-2', ...data }));
    const res: any = await service.create({ name: 'Baru', departmentId: 'd1' });
    expect(res.code).toMatch(/^DIV-[0-9A-F]{8}$/);
  });

  it('rejects duplicate code', async () => {
    const { service, prisma }: any = await boot();
    prisma.division.findUnique.mockResolvedValue({ id: 'dup' });
    await expect(service.create({ code: 'X', name: 'X', departmentId: 'd1' } as any)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects missing or inactive department', async () => {
    const { service, prisma }: any = await boot();
    prisma.division.findUnique.mockResolvedValue(null);
    prisma.department.findUnique.mockResolvedValue(null);
    await expect(service.create({ code: 'X', name: 'X', departmentId: 'nope' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('moves structure via departmentId update', async () => {
    const { service, prisma }: any = await boot();
    prisma.division.findUnique.mockResolvedValue({ id: 'div-1' });
    prisma.department.findUnique.mockResolvedValue({ id: 'd2', isActive: true });
    prisma.division.update.mockImplementation(async ({ data }: any) => ({ id: 'div-1', ...data }));
    const res: any = await service.update('div-1', { departmentId: 'd2' });
    expect(res.departmentId).toBe('d2');
  });

  it('blocks deactivation while employees or positions attached', async () => {
    const { service, prisma }: any = await boot();
    prisma.division.findUnique.mockResolvedValue({
      id: 'div-1',
      _count: { employees: 1, positions: 0 },
    });
    await expect(service.remove('div-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 404 for unknown division', async () => {
    const { service, prisma }: any = await boot();
    prisma.division.findUnique.mockResolvedValue(null);
    await expect(service.findById('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
