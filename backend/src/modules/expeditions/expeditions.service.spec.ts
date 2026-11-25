import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { ExpeditionsService } from './expeditions.service';

const CODE_RE = /^[A-Z0-9]{10}$/;

/**
 * IGDERP-312 — expedition codes are 10-char alphanumeric (A-Z, 0-9),
 * add-modal carries a kode field, and keterangan (description) persists.
 */
describe('ExpeditionsService code + description (IGDERP-312)', () => {
  let service: ExpeditionsService;
  let prisma: {
    expedition: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      expedition: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpeditionsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ExpeditionsService>(ExpeditionsService);
  });

  describe('generateCode', () => {
    it('produces a 10-char alphanumeric code', async () => {
      prisma.expedition.findUnique.mockResolvedValue(null);
      const code = await service.generateCode();
      expect(code).toMatch(CODE_RE);
    });

    it('retries when the code already exists', async () => {
      prisma.expedition.findUnique
        .mockResolvedValueOnce({ id: 'taken' })
        .mockResolvedValue(null);
      const code = await service.generateCode();
      expect(code).toMatch(CODE_RE);
      expect(prisma.expedition.findUnique).toHaveBeenCalledTimes(2);
    });

    it('throws after 10 consecutive collisions', async () => {
      prisma.expedition.findUnique.mockResolvedValue({ id: 'taken' });
      await expect(service.generateCode()).rejects.toThrow(BadRequestException);
      expect(prisma.expedition.findUnique).toHaveBeenCalledTimes(10);
    });
  });

  describe('create', () => {
    beforeEach(() => {
      prisma.expedition.findUnique.mockResolvedValue(null); // code free
      prisma.expedition.findFirst.mockResolvedValue(null); // name free
      prisma.expedition.create.mockImplementation(async ({ data }: any) => ({
        id: 'exp-1',
        ...data,
      }));
    });

    it('auto-generates a 10-char code when none is provided', async () => {
      const result = await service.create({ name: 'JNE' } as any);
      expect(result.code).toMatch(CODE_RE);
      expect(prisma.expedition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'JNE', isActive: true }),
      });
    });

    it('persists keterangan (description)', async () => {
      const result = await service.create({
        name: 'JNE',
        description: 'Reguler darat',
      } as any);
      expect(result.description).toBe('Reguler darat');
    });

    it('stores null description when omitted', async () => {
      const result = await service.create({ name: 'JNE' } as any);
      expect(result.description).toBeNull();
    });
  });

  describe('update', () => {
    it('persists keterangan (description) changes', async () => {
      const current = { id: 'exp-1', code: 'ABC123DEFG', name: 'JNE' };
      prisma.expedition.findFirst.mockResolvedValue(current);
      prisma.expedition.update.mockImplementation(async ({ data }: any) => ({
        ...current,
        ...data,
      }));

      const result = await service.update('exp-1', {
        description: 'Kargo udara',
      } as any);
      expect(result.description).toBe('Kargo udara');
      expect(prisma.expedition.update).toHaveBeenCalledWith({
        where: { id: 'exp-1' },
        data: expect.objectContaining({ description: 'Kargo udara' }),
      });
    });
  });
});
