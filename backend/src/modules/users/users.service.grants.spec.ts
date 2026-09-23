import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * IGDERP-141 (Plan C): feature-level enrollment — allowlisted grants.
 * Covers assignRole validation + storage; the merge behavior lives in
 * permissions.util.spec.ts.
 */
describe('UsersService assignRole — feature grants (IGDERP-141)', () => {
  let service: UsersService;
  let prisma: any;
  let redis: any;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      role: { findUnique: jest.fn() },
      branch: { findFirst: jest.fn() },
      userBranch: { findFirst: jest.fn(), create: jest.fn() },
    };
    redis = { incr: jest.fn().mockResolvedValue(1), get: jest.fn().mockResolvedValue(null) };
    const passwordService = { hash: jest.fn(), compare: jest.fn() } as any;
    service = new UsersService(prisma, passwordService, redis);

    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    prisma.role.findUnique.mockResolvedValue({
      id: 'r1',
      code: 'CS',
      defaultPermissions: ['menu.pos', 'menu.sales', 'action.view'],
    });
    prisma.branch.findFirst.mockResolvedValue({ id: 'b1' });
    prisma.userBranch.findFirst.mockResolvedValue(null);
    prisma.userBranch.create.mockResolvedValue({ id: 'ub1' });
    jest.spyOn(service, 'findById').mockResolvedValue({ id: 'u1' } as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('rejects grants outside the allowlist (no assignment created)', async () => {
    await expect(
      service.assignRole(
        'u1',
        { roleId: 'r1', branchId: 'b1', grantedPermissions: ['finance.coa.create'] } as any,
        'admin',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.userBranch.create).not.toHaveBeenCalled();

    await expect(
      service.assignRole(
        'u1',
        { roleId: 'r1', branchId: 'b1', grantedPermissions: ['users.user.create'] } as any,
        'admin',
      ),
    ).rejects.toThrow('Not grantable permissions: users.user.create');
  });

  it('stores allowlisted grants and bumps the permission version', async () => {
    await service.assignRole(
      'u1',
      { roleId: 'r1', branchId: 'b1', grantedPermissions: ['action.pos.create', 'action.pos.edit'] } as any,
      'admin',
    );
    expect(prisma.userBranch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          grantedPermissions: ['action.pos.create', 'action.pos.edit'],
        }),
      }),
    );
    expect(redis.incr).toHaveBeenCalledWith('auth:ver:u1');
  });

  it('keeps legacy payloads unchanged — grants default to empty array', async () => {
    await service.assignRole('u1', { roleId: 'r1', branchId: 'b1' } as any, 'admin');
    expect(prisma.userBranch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ grantedPermissions: [] }),
      }),
    );
  });
});
