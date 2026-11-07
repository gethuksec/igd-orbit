import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { ServiceCheckpointsService } from './service-checkpoints.service';

/**
 * IGDERP-162B — service-checkpoints inactive filter always empty.
 * Root cause: delete() did a HARD prisma.serviceCheckpoint.delete, so
 * inactive rows could never exist even though findAll() supports
 * status active/inactive. Fix: soft-delete via isActive=false.
 * (ServiceCheckpoint has no deletedAt column — isActive=false only.)
 */
describe('ServiceCheckpointsService soft delete (IGDERP-162B)', () => {
  let service: ServiceCheckpointsService;
  let prisma: {
    serviceCheckpoint: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      aggregate: jest.Mock;
    };
  };

  const existing = { id: 'chk-1', name: 'Kelengkapan', isActive: true, sortOrder: 0 };

  beforeEach(async () => {
    prisma = {
      serviceCheckpoint: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _max: { sortOrder: 0 } }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceCheckpointsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ServiceCheckpointsService>(ServiceCheckpointsService);
  });

  describe('delete', () => {
    it('soft-deletes via update isActive=false instead of hard-deleting', async () => {
      prisma.serviceCheckpoint.findUnique.mockResolvedValue(existing);

      await service.delete('chk-1');

      expect(prisma.serviceCheckpoint.update).toHaveBeenCalledWith({
        where: { id: 'chk-1' },
        data: { isActive: false },
      });
      expect(prisma.serviceCheckpoint.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for unknown id (no update call)', async () => {
      prisma.serviceCheckpoint.findUnique.mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toThrow(NotFoundException);
      expect(prisma.serviceCheckpoint.update).not.toHaveBeenCalled();
      expect(prisma.serviceCheckpoint.delete).not.toHaveBeenCalled();
    });
  });

  describe('findAll status filter', () => {
    it("status='inactive' filters isActive=false (soft-deleted rows visible)", async () => {
      await service.findAll({ status: 'inactive' } as any);

      expect(prisma.serviceCheckpoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it("status='active' filters isActive=true", async () => {
      await service.findAll({ status: 'active' } as any);

      expect(prisma.serviceCheckpoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });
  });

  describe('duplicate-name guards stay reusable after delete', () => {
    it('create scopes the duplicate check to isActive:true so a deleted name can be reused', async () => {
      prisma.serviceCheckpoint.findFirst.mockResolvedValue(null);
      prisma.serviceCheckpoint.create.mockImplementation(async ({ data }: any) => ({
        id: 'chk-2',
        ...data,
      }));

      await service.create({ name: 'Kelengkapan' } as any);

      expect(prisma.serviceCheckpoint.findFirst).toHaveBeenCalledWith({
        where: { name: 'Kelengkapan', isActive: true },
      });
      expect(prisma.serviceCheckpoint.create).toHaveBeenCalled();
    });
  });

  describe('findActive (service forms)', () => {
    it('returns isActive:true only', async () => {
      prisma.serviceCheckpoint.findMany.mockResolvedValue([existing]);

      await service.findActive();

      expect(prisma.serviceCheckpoint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });
  });
});
