import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { PayrollComponentsService } from './payroll-components.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

function mockDelegate() {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
}

async function boot() {
  const delegates = { payrollComponentMaster: mockDelegate() };
  const module: TestingModule = await Test.createTestingModule({
    providers: [PayrollComponentsService, { provide: PrismaService, useValue: delegates }],
  }).compile();
  return { service: module.get(PayrollComponentsService), prisma: delegates };
}

describe('PayrollComponentsService (IGDERP-284)', () => {
  it('creates an earning component with generated code', async () => {
    const { service, prisma }: any = await boot();
    prisma.payrollComponentMaster.findUnique.mockResolvedValue(null);
    prisma.payrollComponentMaster.findFirst.mockResolvedValue(null);
    prisma.payrollComponentMaster.create.mockImplementation(async ({ data }: any) => ({ id: 'c-1', ...data }));
    const res: any = await service.create({ name: 'Gaji Pokok', category: 'earning', source: 'manual' });
    expect(res.category).toBe('earning');
    expect(res.code).toMatch(/^CMP-/);
  });

  it('rejects unknown category', async () => {
    const { service }: any = await boot();
    await expect(service.create({ name: 'X', category: 'bonus' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects unknown source', async () => {
    const { service }: any = await boot();
    await expect(
      service.create({ name: 'X', category: 'earning', source: 'magic' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects grade source with non-object tiers', async () => {
    const { service }: any = await boot();
    await expect(
      service.create({ name: 'Tunj Jabatan', category: 'earning', source: 'grade', tiers: 'G1' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate code', async () => {
    const { service, prisma }: any = await boot();
    prisma.payrollComponentMaster.findUnique.mockResolvedValue({ id: 'c-0', code: 'GAJI-POKOK' });
    await expect(
      service.create({ code: 'GAJI-POKOK', name: 'Other', category: 'earning' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects duplicate name among live rows', async () => {
    const { service, prisma }: any = await boot();
    prisma.payrollComponentMaster.findUnique.mockResolvedValue(null);
    prisma.payrollComponentMaster.findFirst.mockResolvedValue({ id: 'c-0', name: 'Gaji Pokok' });
    await expect(
      service.create({ name: 'Gaji Pokok', category: 'earning' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('checklist query defaults to active non-deleted', async () => {
    const { service, prisma }: any = await boot();
    prisma.payrollComponentMaster.findMany.mockResolvedValue([]);
    prisma.payrollComponentMaster.count.mockResolvedValue(0);
    await service.findAll({});
    const where = prisma.payrollComponentMaster.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ deletedAt: null, isActive: true });
  });

  it('category filter rejects unknown values', async () => {
    const { service }: any = await boot();
    await expect(service.findAll({ category: 'bonus' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft-deletes on remove', async () => {
    const { service, prisma }: any = await boot();
    prisma.payrollComponentMaster.findFirst.mockResolvedValue({ id: 'c-1', code: 'SELISIH' });
    prisma.payrollComponentMaster.update.mockResolvedValue({});
    await service.remove('c-1');
    const data = prisma.payrollComponentMaster.update.mock.calls[0][0].data;
    expect(data.isActive).toBe(false);
    expect(data.deletedAt).toBeInstanceOf(Date);
  });

  it('remove on missing row throws 404', async () => {
    const { service, prisma }: any = await boot();
    prisma.payrollComponentMaster.findFirst.mockResolvedValue(null);
    await expect(service.remove('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
