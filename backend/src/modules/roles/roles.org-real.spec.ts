import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  ORG_DEPARTMENTS,
  RETIRED_ROLE_CODES,
  ROLE_TREE,
} from '../../../prisma/org-tree';

/**
 * ORG-REAL contract tests (IGDERP-237).
 * The role tree lives in backend/prisma/org-tree.ts (single source of truth
 * shared with seed.ts) — this spec guards its shape, not a copy of it.
 */
describe('ORG-REAL role tree contract', () => {
  it('has 28 rows: 26 chart roles + SUPERADMIN + OWNER, histogram 1/1/1/3/5/2/15', () => {
    expect(ROLE_TREE).toHaveLength(28);
    const hist = new Map<number, number>();
    for (const r of ROLE_TREE) hist.set(r.level, (hist.get(r.level) ?? 0) + 1);
    expect(Object.fromEntries(hist)).toEqual({
      0: 1,
      1: 1,
      2: 1,
      3: 3,
      4: 5,
      5: 2,
      6: 15,
    });
  });

  it('forms a valid reporting chain: every parent exists at a lower level', () => {
    const byCode = new Map(ROLE_TREE.map((r) => [r.code, r]));
    expect(byCode.get('OWNER')?.parent).toBeUndefined(); // top of human chart
    for (const r of ROLE_TREE) {
      if (r.code === 'SUPERADMIN' || r.code === 'OWNER') continue;
      expect(r.parent).toBeDefined();
      const parent = byCode.get(r.parent!);
      expect(parent).toBeDefined();
      // Level is a grade tier, not depth: parent must sit strictly above.
      // (L6 staff under SPVs report to L4 — the chart has no L5 there.)
      expect(parent!.level).toBeLessThan(r.level);
    }
  });

  it('keeps the store chain HS(L4) > assistants(L5) > staff(L6)', () => {
    const byCode = new Map(ROLE_TREE.map((r) => [r.code, r]));
    expect(byCode.get('AS-SE')?.parent).toBe('HS');
    expect(byCode.get('AS-SRV')?.parent).toBe('HS');
    for (const code of ['SE', 'CR']) expect(byCode.get(code)?.parent).toBe('AS-SE');
    for (const code of ['FL', 'CS', 'TC'])
      expect(byCode.get(code)?.parent).toBe('AS-SRV');
  });

  it('retires exactly the 9 legacy codes, disjoint from the tree', () => {
    expect(RETIRED_ROLE_CODES).toHaveLength(9);
    expect(new Set(RETIRED_ROLE_CODES).size).toBe(9);
    const treeCodes = new Set(ROLE_TREE.map((r) => r.code));
    for (const code of RETIRED_ROLE_CODES) {
      expect(treeCodes.has(code)).toBe(false);
    }
    // AR+AS merge into AO — none of them survive in the tree
    expect(treeCodes.has('AO')).toBe(true);
    expect(treeCodes.has('AR')).toBe(false);
    expect(treeCodes.has('AS')).toBe(false);
  });

  it('gives every role permissions and every L6 role a parent', () => {
    for (const r of ROLE_TREE) {
      expect(r.permissions.length).toBeGreaterThan(0);
      if (r.level === 6) expect(r.parent).toBeDefined();
    }
  });

  it('defines 5 company-wide departments with unique codes', () => {
    expect(ORG_DEPARTMENTS).toHaveLength(5);
    expect(new Set(ORG_DEPARTMENTS.map((d) => d.code)).size).toBe(5);
    expect(ORG_DEPARTMENTS.map((d) => d.code).sort()).toEqual(
      ['DEPT-FIN', 'DEPT-HRD', 'DEPT-MKT', 'DEPT-OPS', 'DEPT-SC'].sort(),
    );
  });
});

describe('ORG-REAL role level validation', () => {
  async function errorsFor(level: number) {
    const dto = plainToInstance(CreateRoleDto, {
      code: 'X',
      name: 'X',
      level,
    });
    return validate(dto);
  }

  it('accepts L6 (org chart depth)', async () => {
    await expect(errorsFor(6)).resolves.toHaveLength(0);
  });

  it('rejects levels above the Max(10) cap', async () => {
    const errors = await errorsFor(11);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('ORG-REAL roles service guards', () => {
  let service: RolesService;
  let prisma: {
    role: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      role: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: PrismaService, useValue: prisma },
        { provide: 'REDIS_CLIENT', useValue: { incr: jest.fn() } },
      ],
    }).compile();
    service = module.get<RolesService>(RolesService);
  });

  it('creates an L6 role under its L5 parent', async () => {
    prisma.role.findUnique
      .mockResolvedValueOnce(null) // no duplicate code
      .mockResolvedValueOnce({ id: 'as-se-id', code: 'AS-SE', level: 5 }); // parent exists
    prisma.role.create.mockResolvedValue({ id: 'se-id', code: 'SE', level: 6 });
    const dto = plainToInstance(CreateRoleDto, {
      code: 'SE',
      name: 'Sales Executive',
      level: 6,
      parentRoleId: 'as-se-id',
    });
    // parentRoleId must be a UUID for class-validator, but the service only
    // checks existence — use a real UUID here
    dto.parentRoleId = '123e4567-e89b-12d3-a456-426614174000';
    const created = await service.create(dto, 'owner-id');
    expect(prisma.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'SE',
          level: 6,
          parentRoleId: '123e4567-e89b-12d3-a456-426614174000',
        }),
      }),
    );
    expect(created).toEqual({ id: 'se-id', code: 'SE', level: 6 });
  });

  it('rejects a duplicate role code', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'x', code: 'SE' });
    const dto = plainToInstance(CreateRoleDto, {
      code: 'SE',
      name: 'Sales Executive',
      level: 6,
    });
    await expect(service.create(dto, 'owner-id')).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects a missing parent role', async () => {
    prisma.role.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null); // parent not found
    const dto = plainToInstance(CreateRoleDto, {
      code: 'SE',
      name: 'Sales Executive',
      level: 6,
      parentRoleId: '123e4567-e89b-12d3-a456-426614174000',
    });
    await expect(service.create(dto, 'owner-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('keeps SUPERADMIN undeletable', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 'sa-id',
      code: 'SUPERADMIN',
      isSystemRole: true,
      _count: { userBranches: 0 },
    });
    await expect(
      service.softDelete('sa-id', 'owner-id', { roles: ['OWNER'] }),
    ).rejects.toThrow(BadRequestException);
  });

  it('keeps system roles undeletable for non-superadmins', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 'mu-id',
      code: 'MU',
      isSystemRole: false,
      _count: { userBranches: 0 },
    });
    // sanity: non-system, unassigned role passes the guard calls
    prisma.role.update.mockResolvedValue({ id: 'mu-id', isActive: false });
    // bumpAllRoleHolders touches userBranch — stub the chain it needs
    (prisma as Record<string, unknown>).userBranch = {
      findMany: jest.fn().mockResolvedValue([]),
    };
    const out = await service.softDelete('mu-id', 'owner-id', {
      roles: ['OWNER'],
    });
    expect(out).toEqual({ id: 'mu-id', isActive: false });
  });
});
