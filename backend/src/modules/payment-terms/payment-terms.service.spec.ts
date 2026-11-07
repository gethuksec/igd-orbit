import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { PaymentTermsService } from './payment-terms.service';

/**
 * IGDERP-162A — payment-terms inactive filter always empty.
 * Root cause: findAll() hardcoded `deletedAt: null`, but delete() sets
 * isActive=false AND deletedAt=now, so trashed rows were always excluded.
 * Fix: products-style status-aware deletedAt logic.
 */
describe('PaymentTermsService status filter (IGDERP-162A)', () => {
  let service: PaymentTermsService;
  let prisma: {
    paymentTerm: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      paymentTerm: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentTermsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PaymentTermsService>(PaymentTermsService);
  });

  describe('findAll where-clause', () => {
    it("status='inactive' looks at trashed rows (deletedAt not null + isActive false)", async () => {
      await service.findAll({ status: 'inactive' } as any);

      expect(prisma.paymentTerm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: false,
            deletedAt: { not: null },
          }),
        }),
      );
      expect(prisma.paymentTerm.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          isActive: false,
          deletedAt: { not: null },
        }),
      });
    });

    it('default (no status) returns live rows only (deletedAt null + isActive true)', async () => {
      await service.findAll({} as any);

      expect(prisma.paymentTerm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            deletedAt: null,
          }),
        }),
      );
    });

    it("status='active' returns live rows only", async () => {
      await service.findAll({ status: 'active' } as any);

      expect(prisma.paymentTerm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            deletedAt: null,
          }),
        }),
      );
    });

    it("status='all' applies no deletedAt / isActive filter", async () => {
      await service.findAll({ status: 'all' } as any);

      const where = prisma.paymentTerm.findMany.mock.calls[0][0].where;
      expect(where.deletedAt).toBeUndefined();
      expect(where.isActive).toBeUndefined();
    });

    it('includeInactive without status shows all records', async () => {
      await service.findAll({ includeInactive: true } as any);

      const where = prisma.paymentTerm.findMany.mock.calls[0][0].where;
      expect(where.deletedAt).toBeUndefined();
      expect(where.isActive).toBeUndefined();
    });
  });
});
