/**
 * IGDERP-121 — SUPERADMIN fixed-role guard contract.
 * Fixed set = SUPERADMIN only (locked 2026-11-04): it cannot be created,
 * renamed (code is not in UpdateRoleDto by design), edited, deactivated or
 * deleted via the API. All other roles remain flexible.
 */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RolesService } from './roles.service';

describe('RolesService SUPERADMIN guard (IGDERP-121)', () => {
  const SUPERADMIN_ROW: any = {
    id: 'role-superadmin',
    code: 'SUPERADMIN',
    name: 'Super Administrator',
    level: 0,
    isActive: true,
    isSystemRole: true,
    parentRoleId: null,
    defaultPermissions: ['*'],
  };
  const OWNER_ROW: any = {
    id: 'role-owner',
    code: 'OWNER',
    name: 'Owner',
    level: 1,
    isActive: true,
    isSystemRole: false,
    parentRoleId: null,
    defaultPermissions: [],
  };

  let prisma: any;
  let service: RolesService;

  beforeEach(() => {
    prisma = {
      role: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      userBranch: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const redis: any = { incr: jest.fn() };
    service = new RolesService(prisma, redis);
  });

  it('refuses to create a second role with the reserved code', async () => {
    await expect(
      service.create({ code: 'SUPERADMIN', name: 'Fake', level: 0 } as any, 'u1'),
    ).rejects.toThrow(ConflictException);
    expect(prisma.role.create).not.toHaveBeenCalled();
  });

  it.each([
    ['name', { name: 'Renamed' }],
    ['description', { description: 'x' }],
    ['level', { level: 5 }],
    ['isActive', { isActive: false }],
    ['parentRoleId', { parentRoleId: 'role-owner' }],
    ['defaultPermissions', { defaultPermissions: [] }],
  ])('rejects SUPERADMIN update touching %s', async (_field, dto) => {
    prisma.role.findUnique.mockResolvedValue(SUPERADMIN_ROW);
    await expect(
      service.update('role-superadmin', dto as any, 'u1', { roles: ['SUPERADMIN'] }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.role.update).not.toHaveBeenCalled();
  });

  it('allows a no-op update call on SUPERADMIN (no DB-only violation)', async () => {
    prisma.role.findUnique.mockResolvedValue(SUPERADMIN_ROW);
    prisma.role.update.mockResolvedValue(SUPERADMIN_ROW);
    await service.update('role-superadmin', {}, 'u1', { roles: ['SUPERADMIN'] });
    expect(prisma.role.update).toHaveBeenCalled();
  });

  it('lets flexible roles update normally (121: only SUPERADMIN is fixed)', async () => {
    prisma.role.findUnique.mockResolvedValue(OWNER_ROW);
    prisma.role.update.mockResolvedValue({ ...OWNER_ROW, name: 'Pemilik' });
    const out = await service.update(
      'role-owner',
      { name: 'Pemilik' } as any,
      'u1',
      { roles: ['SUPERADMIN'] },
    );
    expect(out.name).toBe('Pemilik');
  });

  it('rejects unknown role ids before any guard logic', async () => {
    prisma.role.findUnique.mockResolvedValue(null);
    await expect(
      service.update('nope', { name: 'x' } as any, 'u1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses to deactivate SUPERADMIN via softDelete', async () => {
    prisma.role.findUnique.mockResolvedValue({
      ...SUPERADMIN_ROW,
      _count: { userBranches: 1 },
    });
    await expect(service.softDelete('role-superadmin', 'u1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.role.update).not.toHaveBeenCalled();
  });

  it('lets SUPERADMIN deactivate a flexible assigned role (manual ops stay possible)', async () => {
    prisma.role.findUnique.mockResolvedValue({
      ...OWNER_ROW,
      _count: { userBranches: 2 },
    });
    prisma.role.update.mockResolvedValue({ ...OWNER_ROW, isActive: false });
    const out = await service.softDelete('role-owner', 'u1', {
      roles: ['SUPERADMIN'],
    });
    expect(out.isActive).toBe(false);
  });
});
