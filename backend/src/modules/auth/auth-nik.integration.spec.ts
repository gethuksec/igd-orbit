import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/services/prisma.service';
import { PasswordService } from '../../shared/services/password.service';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

/**
 * IGDERP-275: NIK-or-email login (mocked-Prisma integration, real bcrypt).
 */
describe('AuthService NIK login (IGDERP-275 integration)', () => {
  let service: AuthService;
  let prisma: any;

  const userRow = (over: any = {}) => ({
    id: 'u-1',
    email: 'staff@igd.test',
    username: 'staff',
    fullName: 'Staff Satu',
    passwordHash: bcrypt.hashSync('secret123', 4),
    isActive: true,
    deletedAt: null,
    lockedUntil: null,
    banReason: null,
    failedLoginAttempts: 0,
    userBranches: [],
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      employee: { findUnique: jest.fn() },
      userBranch: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        PasswordService,
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('jwt') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(undefined) } },
        { provide: 'REDIS_CLIENT', useValue: { hset: jest.fn(), expire: jest.fn(), hgetall: jest.fn().mockResolvedValue({}) } },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
  });

  it('email login still works (back-compat)', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    const user = await service.validateUser('staff@igd.test', 'secret123');
    expect(user?.id).toBe('u-1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'staff@igd.test' } }),
    );
  });

  it('NIK login resolves employee → user', async () => {
    const user = userRow();
    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1', nik: '12345', user });
    const res = await service.validateUser('12345', 'secret123');
    expect(res?.id).toBe('u-1');
    expect(prisma.employee.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { nik: '12345' } }),
    );
  });

  it('unknown NIK returns null; wrong password throws', async () => {
    prisma.employee.findUnique.mockResolvedValue(null);
    await expect(service.validateUser('99999', 'secret123')).resolves.toBeNull();

    prisma.employee.findUnique.mockResolvedValue({ id: 'emp-1', nik: '12345', user: userRow() });
    await expect(service.validateUser('12345', 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
