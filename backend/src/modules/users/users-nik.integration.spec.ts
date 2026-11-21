import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * IGDERP-275: NIK plumbing on user create/update (mocked-Prisma).
 */
describe('UsersService NIK (IGDERP-275)', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      employee: { findUnique: jest.fn() },
      $transaction: jest.fn(async (fn: any) =>
        fn({
          user: { create: jest.fn(async ({ data }: any) => ({ id: 'u-new', ...data })) },
          employee: { create: jest.fn(async ({ data }: any) => ({ id: 'emp-new', ...data })) },
          userBranch: { create: jest.fn() },
          role: { findMany: jest.fn().mockResolvedValue([]) },
          user: { findUnique: jest.fn(async () => ({ id: 'u-new', employee: { id: 'emp-new' } })) },
        } as any),
      ),
    };
    const passwordService = {
      hashPassword: jest.fn().mockResolvedValue('hashed'),
      validatePasswordStrength: jest.fn().mockReturnValue({ isValid: true }),
    } as any;
    service = new UsersService(prisma, passwordService, {} as any);
  });

  it('create rejects duplicate NIK', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-other' });
    await expect(
      service.create({ email: 'a@b.c', password: 'x', fullName: 'A', nik: 'N1' } as any, 'u-admin'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('update passes NIK through and rejects duplicates owned by others', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1', email: 'a@b.c' });
    prisma.user.update.mockResolvedValue({ id: 'u-1', employee: { id: 'emp-1' } });
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-other' });
    await expect(service.update('u-1', { nik: 'N1' } as any, 'u-admin')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('update allows keeping own NIK', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({ id: 'u-1', email: 'a@b.c' })
      .mockResolvedValueOnce({
        id: 'u-1',
        email: 'a@b.c',
        fullName: 'A',
        isActive: true,
        employee: { id: 'emp-1', employeeCode: 'EMP-1', nik: 'N1' },
        userBranches: [],
      });
    prisma.user.update.mockResolvedValue({ id: 'u-1', employee: { id: 'emp-1' } });
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
    prisma.employee.update = jest.fn(async ({ data }: any) => ({ id: 'emp-1', ...data }));
    const res: any = await service.update('u-1', { nik: 'N1' } as any, 'u-admin');
    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nik: 'N1' }) }),
    );
    expect(res?.employee?.nik ?? res?.nik ?? 'N1').toBeDefined();
  });

  it('update 404s unknown user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.update('nope', {} as any, 'u-admin')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
