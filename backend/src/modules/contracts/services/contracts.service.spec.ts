import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/services/prisma.service';
import { PasswordService } from '../../../shared/services/password.service';
import {
  ContractsService,
  resolveTenureAnchor,
  hasActiveContract,
} from './contracts.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

function mockDelegate(extra: any = {}) {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    ...extra,
  };
}

async function boot(overrides: any = {}) {
  const delegates: any = {
    contract: mockDelegate(),
    employee: mockDelegate(),
    workingLocation: mockDelegate(),
    position: mockDelegate(),
    grade: mockDelegate(),
    division: mockDelegate(),
    department: mockDelegate(),
    branch: mockDelegate(),
    user: mockDelegate(),
    userBranch: mockDelegate(),
    role: mockDelegate(),
    ...overrides,
  };
  const passwordService = {
    validatePasswordStrength: jest.fn(() => ({ isValid: true })),
    hashPassword: jest.fn(async () => 'hashed'),
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ContractsService,
      { provide: PrismaService, useValue: delegates },
      { provide: PasswordService, useValue: passwordService },
    ],
  }).compile();
  return { service: module.get(ContractsService), prisma: delegates, passwordService };
}

const EMP = 'emp-1';

describe('ContractsService caps (IGDERP-270)', () => {
  it('rejects a second trial (1x cap)', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: EMP });
    prisma.contract.count.mockResolvedValue(1);
    await expect(
      service.create({ employeeId: EMP, type: 'trial', startDate: '2026-01-05', endDate: '2026-02-04' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects trial longer than 1 month', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: EMP });
    prisma.contract.count.mockResolvedValue(0);
    await expect(
      service.create({ employeeId: EMP, type: 'trial', startDate: '2026-01-05', endDate: '2026-04-05' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a third PKWT (2x cap)', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: EMP });
    prisma.contract.count.mockResolvedValue(2);
    await expect(
      service.create({ employeeId: EMP, type: 'pkwt', startDate: '2026-01-01', endDate: '2026-12-31' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects PKWT longer than 1 year', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: EMP });
    prisma.contract.count.mockResolvedValue(0);
    await expect(
      service.create({ employeeId: EMP, type: 'pkwt', startDate: '2026-01-01', endDate: '2027-06-30' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects PKWTT with an end date (permanent)', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: EMP });
    prisma.contract.count.mockResolvedValue(0);
    await expect(
      service.create({ employeeId: EMP, type: 'pkwtt', startDate: '2026-01-01', endDate: '2027-01-01' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a second PKWTT (terminal 1x)', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: EMP });
    prisma.contract.count.mockResolvedValue(1);
    await expect(
      service.create({ employeeId: EMP, type: 'pkwtt', startDate: '2026-01-01' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects probationEndDate on PKWT', async () => {
    const { service, prisma }: any = await boot();
    await expect(
      service.create({
        employeeId: EMP,
        type: 'pkwt',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        probationEndDate: '2026-04-01',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a valid trial with generated number', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: EMP });
    prisma.contract.count.mockResolvedValue(0);
    prisma.contract.findUnique.mockResolvedValue(null);
    prisma.contract.create.mockImplementation(async ({ data }: any) => ({ id: 'c-1', ...data }));
    const res: any = await service.create({
      employeeId: EMP,
      type: 'trial',
      startDate: '2026-01-05',
      endDate: '2026-02-04',
    } as any);
    expect(res.contractNumber).toMatch(/^CTR-\d{6}-[0-9A-F]{6}$/);
    expect(res.changeReason).toBe('initial');
  });

  it('uses a manual contract number when provided', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: EMP });
    prisma.contract.count.mockResolvedValue(0);
    prisma.contract.findUnique.mockResolvedValue(null);
    prisma.contract.create.mockImplementation(async ({ data }: any) => ({ id: 'c-1', ...data }));
    const res: any = await service.create({
      employeeId: EMP,
      type: 'trial',
      startDate: '2026-01-05',
      endDate: '2026-02-04',
      contractNumber: 'CTR-MANUAL-001',
    } as any);
    expect(res.contractNumber).toBe('CTR-MANUAL-001');
  });

  it('rejects a duplicate manual contract number', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: EMP });
    prisma.contract.count.mockResolvedValue(0);
    prisma.contract.findUnique.mockResolvedValue({ id: 'c-taken', contractNumber: 'CTR-MANUAL-001' });
    await expect(
      service.create({
        employeeId: EMP,
        type: 'trial',
        startDate: '2026-01-05',
        endDate: '2026-02-04',
        contractNumber: 'CTR-MANUAL-001',
      } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('persists a grade snapshot when provided', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: EMP });
    prisma.grade.findUnique.mockResolvedValue({ id: 'g-3', code: 'G3' });
    prisma.contract.count.mockResolvedValue(0);
    prisma.contract.findUnique.mockResolvedValue(null);
    prisma.contract.create.mockImplementation(async ({ data }: any) => ({ id: 'c-1', ...data }));
    const res: any = await service.create({
      employeeId: EMP,
      type: 'pkwt',
      startDate: '2026-01-01',
      endDate: '2026-12-01',
      gradeId: 'g-3',
    } as any);
    expect(res.gradeId).toBe('g-3');
  });

  it('rejects an unknown grade', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: EMP });
    prisma.grade.findUnique.mockResolvedValue(null);
    await expect(
      service.create({
        employeeId: EMP,
        type: 'pkwt',
        startDate: '2026-01-01',
        endDate: '2026-12-01',
        gradeId: 'g-nope',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marks the previous row renewed on renewal', async () => {
    const { service, prisma }: any = await boot();
    prisma.employee.findUnique.mockResolvedValue({ id: EMP });
    prisma.contract.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.contractNumber) return null;
      return { id: 'c-prev', employeeId: EMP, status: 'active' };
    });
    prisma.contract.count.mockResolvedValue(0);
    prisma.contract.create.mockImplementation(async ({ data }: any) => ({ id: 'c-new', ...data }));
    const res: any = await service.create({
      employeeId: EMP,
      type: 'pkwt',
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      previousContractId: 'c-prev',
    } as any);
    expect(res.changeReason).toBe('renewal');
    expect(prisma.contract.update).toHaveBeenCalledWith({
      where: { id: 'c-prev' },
      data: { status: 'renewed' },
    });
  });
});

describe('ContractsService lifecycle guards (IGDERP-270)', () => {
  it('refuses to edit terminal history rows', async () => {
    const { service, prisma }: any = await boot();
    prisma.contract.findUnique.mockResolvedValue({ id: 'c-1', status: 'expired', type: 'trial' });
    await expect(service.update('c-1', { endDate: '2026-03-01' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses illegal status transitions', async () => {
    const { service, prisma }: any = await boot();
    prisma.contract.findUnique.mockResolvedValue({ id: 'c-1', status: 'draft', type: 'trial' });
    await expect(service.update('c-1', { status: 'expired' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses to delete non-draft rows', async () => {
    const { service, prisma }: any = await boot();
    prisma.contract.findUnique.mockResolvedValue({ id: 'c-1', status: 'active' });
    await expect(service.remove('c-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s unknown contracts', async () => {
    const { service, prisma }: any = await boot();
    prisma.contract.findUnique.mockResolvedValue(null);
    await expect(service.findById('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('Tenure anchor (IGDERP-270)', () => {
  it('returns the earliest start of an unbroken chain', async () => {
    const prisma: any = {
      contract: {
        findMany: jest.fn(async () => [
          { startDate: new Date('2026-06-01'), endDate: new Date('2027-05-31') },
          { startDate: new Date('2025-06-01'), endDate: new Date('2026-05-31') },
          { startDate: new Date('2025-02-01'), endDate: new Date('2025-05-31') },
        ]),
      },
    };
    const anchor = await resolveTenureAnchor(prisma, EMP, new Date('2025-02-01'));
    expect(anchor?.toISOString()).toBe(new Date('2025-02-01').toISOString());
  });

  it('resets only on a real service gap', async () => {
    const prisma: any = {
      contract: {
        findMany: jest.fn(async () => [
          { startDate: new Date('2026-06-01'), endDate: new Date('2027-05-31') },
          // gap: previous row ended 2024, new chain starts 2026
          { startDate: new Date('2023-01-01'), endDate: new Date('2024-12-31') },
        ]),
      },
    };
    const anchor = await resolveTenureAnchor(prisma, EMP, null);
    expect(anchor?.toISOString()).toBe(new Date('2026-06-01').toISOString());
  });

  it('falls back to hireDate with no contracts', async () => {
    const prisma: any = { contract: { findMany: jest.fn(async () => []) } };
    const anchor = await resolveTenureAnchor(prisma, EMP, new Date('2024-03-01'));
    expect(anchor?.toISOString()).toBe(new Date('2024-03-01').toISOString());
  });

  it('falls back to hireDate when the delegate predates contracts', async () => {
    const anchor = await resolveTenureAnchor({} as any, EMP, new Date('2024-03-01'));
    expect(anchor?.toISOString()).toBe(new Date('2024-03-01').toISOString());
  });
});

describe('hasActiveContract (IGDERP-270 login gate)', () => {
  it('finds a covering active contract', async () => {
    const prisma: any = { contract: { findFirst: jest.fn(async () => ({ id: 'c-1' })) } };
    await expect(hasActiveContract(prisma, EMP)).resolves.toBe(true);
    const where = prisma.contract.findFirst.mock.calls[0][0].where;
    expect(where.status).toBe('active');
    expect(where.OR).toEqual([{ endDate: null }, { endDate: { gte: expect.any(Date) } }]);
  });

  it('returns false with no covering contract', async () => {
    const prisma: any = { contract: { findFirst: jest.fn(async () => null) } };
    await expect(hasActiveContract(prisma, EMP)).resolves.toBe(false);
  });
});

describe('ContractsService intake (IGDERP-270)', () => {
  function txBoot() {
    const tx: any = {
      user: mockDelegate(),
      employee: mockDelegate(),
      contract: mockDelegate(),
      userBranch: { create: jest.fn() },
    };
    return tx;
  }

  it('writes user + employee + contract + branches in one transaction', async () => {
    const tx = txBoot();
    const { service, prisma }: any = await boot({
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    } as any);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.position.findUnique.mockResolvedValue({
      id: 'pos-1',
      isActive: true,
      defaultRoleId: 'role-cashier',
      divisionId: null,
    });
    prisma.role.findUnique.mockResolvedValue({ id: 'role-cashier', isActive: true });
    prisma.branch.findMany.mockResolvedValue([{ id: 'b-1', isActive: true }]);
    prisma.contract.findUnique.mockResolvedValue(null);
    prisma.employee.findFirst.mockResolvedValue(null);
    tx.user.create.mockImplementation(async ({ data }: any) => ({ id: 'u-1', ...data }));
    tx.employee.findUniqueOrThrow.mockImplementation(async () => ({ id: 'emp-9', userId: 'u-1' }));
    tx.contract.create.mockImplementation(async ({ data }: any) => ({ id: 'c-9', ...data }));
    tx.user.findUniqueOrThrow.mockImplementation(async () => ({ id: 'u-1' }));

    const res: any = await service.intake({
      fullName: 'Eka Putri',
      email: 'eka@igdgroup.com',
      password: 'Secret123!',
      type: 'trial',
      startDate: '2026-12-01',
      endDate: '2026-12-31',
      positionId: 'pos-1',
      branchIds: ['b-1'],
    } as any);

    expect(res.id).toBe('u-1');
    expect(tx.contract.create).toHaveBeenCalled();
    const contractData = tx.contract.create.mock.calls[0][0].data;
    expect(contractData.status).toBe('active');
    expect(contractData.changeReason).toBe('initial');
    expect(contractData.contractBranches.create).toEqual([{ branchId: 'b-1', isPrimary: true }]);
    expect(tx.userBranch.create).toHaveBeenCalledWith({
      data: { userId: 'u-1', roleId: 'role-cashier', branchId: 'b-1', isPrimary: true },
    });
  });

  it('requires a role when the position suggests none', async () => {
    const { service, prisma }: any = await boot();
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.position.findUnique.mockResolvedValue({
      id: 'pos-2',
      isActive: true,
      defaultRoleId: null,
      divisionId: null,
    });
    await expect(
      service.intake({
        fullName: 'X',
        email: 'x@igdgroup.com',
        password: 'Secret123!',
        type: 'trial',
        startDate: '2026-12-01',
        endDate: '2026-12-31',
        positionId: 'pos-2',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate email', async () => {
    const { service, prisma }: any = await boot();
    prisma.user.findUnique.mockResolvedValue({ id: 'taken' });
    await expect(
      service.intake({ fullName: 'X', email: 'x@igdgroup.com', password: 'Secret123!', type: 'trial', startDate: '2026-12-01', endDate: '2026-12-31' } as any),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
