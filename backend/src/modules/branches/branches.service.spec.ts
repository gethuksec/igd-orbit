import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  BranchesService,
  slugifyBranchName,
  shortToken,
  generateIntakeToken,
} from './branches.service';

describe('BranchesService intake identity', () => {
  let service: BranchesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      branch: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      user: { findUnique: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [BranchesService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<BranchesService>(BranchesService);
  });

  describe('slugifyBranchName', () => {
    it('slugifies outlet names', () => {
      expect(slugifyBranchName('Jember Pusat')).toBe('jember-pusat');
      expect(slugifyBranchName('  Kaliwates 2 ')).toBe('kaliwates-2');
    });

    it('falls back to outlet for empty names', () => {
      expect(slugifyBranchName('')).toBe('outlet');
      expect(slugifyBranchName('!!!')).toBe('outlet');
    });
  });

  describe('token helpers', () => {
    it('generates a 48-char hex intake token', () => {
      expect(generateIntakeToken()).toMatch(/^[0-9a-f]{48}$/);
    });

    it('generates a 4-char base36 short token', () => {
      expect(shortToken()).toMatch(/^[0-9a-z]{4}$/);
    });
  });

  describe('create', () => {
    it('auto-generates intakeToken + intakeSlug on new outlets', async () => {
      prisma.branch.findUnique.mockResolvedValue(null); // code + name + token/slug all free
      prisma.branch.findFirst.mockResolvedValue(null);
      prisma.branch.create.mockImplementation(async ({ data }: any) => ({ id: 'b-new', ...data }));
      const res: any = await service.create({ name: 'Jember Pusat' } as any);
      expect(res.intakeToken).toMatch(/^[0-9a-f]{48}$/);
      expect(res.intakeSlug).toMatch(/^jember-pusat-[0-9a-z]{4}$/);
      expect(res.intakePath).toBe(`/r/${res.intakeSlug}`);
      expect(prisma.branch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ intakeToken: res.intakeToken, intakeSlug: res.intakeSlug }),
        }),
      );
    });
  });

  describe('backfillIntakeIdentities', () => {
    it('fills only null fields and never rotates existing values', async () => {
      prisma.branch.findMany.mockResolvedValue([
        { id: 'b1', name: 'Jember Pusat', intakeToken: null, intakeSlug: null },
        { id: 'b2', name: 'Kalisat', intakeToken: 'tok-existing', intakeSlug: 'kalisat-ab12' },
      ]);
      prisma.branch.findUnique.mockResolvedValue(null); // generated values free
      prisma.branch.update.mockImplementation(async () => ({}));
      const res = await service.backfillIntakeIdentities();
      expect(res).toEqual({ processed: 2, backfilled: 1 });
      expect(prisma.branch.update).toHaveBeenCalledTimes(1);
      expect(prisma.branch.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'b1' } }),
      );
    });
  });
});
