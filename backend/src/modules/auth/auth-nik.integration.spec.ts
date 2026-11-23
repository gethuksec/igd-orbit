import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/services/prisma.service';
import { PasswordService } from '../../shared/services/password.service';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

/**
 * IGDERP-275: email-only login (mocked-Prisma integration, real bcrypt).
 * NIK login was removed per 22 Nov 2026 decision — a NIK string matches no
 * user email, so validateUser returns null for it.
 */
describe('AuthService email-only login (IGDERP-275 integration)', () => {
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

  it('email login works', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    const user = await service.validateUser('staff@igd.test', 'secret123');
    expect(user?.id).toBe('u-1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'staff@igd.test' } }),
    );
  });

  it('NIK string matches no email → null (no NIK login)', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.validateUser('12345', 'secret123')).resolves.toBeNull();
    expect(prisma.employee.findUnique).not.toHaveBeenCalled();
  });

  it('unknown email returns null; wrong password throws', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.validateUser('nobody@igd.test', 'secret123')).resolves.toBeNull();

    prisma.user.findUnique.mockResolvedValue(userRow());
    await expect(service.validateUser('staff@igd.test', 'wrong')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
