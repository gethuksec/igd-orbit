import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

/**
 * IGDERP-68 — customer tier (tierCode) ignored on create + update.
 * Root cause: CreateCustomerDto had no `tierCode` property, so the global
 * ValidationPipe (whitelist:true) stripped it before the service ever saw it.
 * The service-side `(dto as any).tierCode` branches were dead code.
 */
describe('CustomersService tier handling (IGDERP-68)', () => {
  let service: CustomersService;
  let prisma: {
    customer: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    customerTier: { findUnique: jest.Mock };
  };

  const GOLD_TIER = { id: 'tier-gold-id', code: 'GOLD', name: 'Gold' };

  beforeEach(async () => {
    prisma = {
      customer: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      customerTier: { findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  describe('create', () => {
    const baseDto = {
      customerCode: 'CUST-TEST-001',
      customerType: 'retail',
      name: 'Test Pelanggan',
      phone: '0812999888777',
    };

    beforeEach(() => {
      // No code/email/phone collisions
      prisma.customer.findUnique.mockResolvedValue(null);
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.create.mockImplementation(async ({ data }: any) => ({
        id: 'cust-1',
        ...data,
        tier: data.tierId ? GOLD_TIER : null,
        preferredBranch: null,
        creditLimit: { toNumber: () => data.creditLimit ?? 0 },
        creditUsed: { toNumber: () => 0 },
        createdAt: new Date(),
      }));
    });

    it('resolves tierCode GOLD (uppercase) to tierId on create', async () => {
      prisma.customerTier.findUnique.mockResolvedValue(GOLD_TIER);

      const result = await service.create(
        { ...baseDto, tierCode: 'GOLD' } as CreateCustomerDto,
        'user-1',
      );

      expect(prisma.customerTier.findUnique).toHaveBeenCalledWith({
        where: { code: 'GOLD' },
      });
      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tierId: 'tier-gold-id' }),
        }),
      );
      expect(result.tier).toMatchObject({ code: 'GOLD' });
    });

    it('resolves lowercase tierCode (case-insensitive) on create', async () => {
      prisma.customerTier.findUnique.mockResolvedValue(GOLD_TIER);

      await service.create(
        { ...baseDto, tierCode: 'gold' } as CreateCustomerDto,
        'user-1',
      );

      expect(prisma.customerTier.findUnique).toHaveBeenCalledWith({
        where: { code: 'GOLD' },
      });
    });

    it('leaves tier null for unknown tierCode on create (no throw)', async () => {
      prisma.customerTier.findUnique.mockResolvedValue(null);

      const result = await service.create(
        { ...baseDto, tierCode: 'NOPE' } as CreateCustomerDto,
        'user-1',
      );

      expect(result.tier).toBeNull();
      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ tierId: expect.anything() }),
        }),
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'cust-1',
        email: 'old@test.com',
        phone: '0811111111111',
      });
      prisma.customer.findFirst.mockResolvedValue(null);
      prisma.customer.update.mockImplementation(async ({ data }: any) => ({
        id: 'cust-1',
        customerCode: 'CUST-TEST-001',
        customerType: 'retail',
        name: 'Test Pelanggan',
        email: 'e2e-test@test.com',
        phone: '0812999888777',
        tier: data.tierId ? GOLD_TIER : null,
        isBlacklisted: false,
        isActive: true,
        creditLimit: { toNumber: () => 0 },
        creditUsed: { toNumber: () => 0 },
        updatedAt: new Date(),
      }));
    });

    it('applies tierCode GOLD on update (IGDERP-68 repro: PUT tierCode:GOLD)', async () => {
      prisma.customerTier.findUnique.mockResolvedValue(GOLD_TIER);

      const result = await service.update(
        'cust-1',
        { name: 'Test Pelanggan', tierCode: 'GOLD' } as UpdateCustomerDto,
        'user-1',
      );

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tierId: 'tier-gold-id' }),
        }),
      );
      expect(result.tier).toMatchObject({ code: 'GOLD' });
    });

    it('clears tier when tierCode is empty string on update', async () => {
      const result = await service.update(
        'cust-1',
        { tierCode: '' } as UpdateCustomerDto,
        'user-1',
      );

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tierId: null }),
        }),
      );
      expect(result.tier).toBeNull();
    });

    it('tierId still takes precedence over tierCode on update', async () => {
      prisma.customerTier.findUnique.mockResolvedValue({
        id: 'tier-direct-id',
        code: 'SILVER',
        name: 'Silver',
      });

      await service.update(
        'cust-1',
        { tierId: 'tier-direct-id', tierCode: 'GOLD' } as UpdateCustomerDto,
        'user-1',
      );

      // tierId path validates via findUnique on the id — the tierCode
      // code-lookup must NOT run when tierId is set
      expect(prisma.customerTier.findUnique).not.toHaveBeenCalledWith({
        where: { code: 'GOLD' },
      });
      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tierId: 'tier-direct-id' }),
        }),
      );
    });
  });

  describe('ValidationPipe whitelist (regression: field must survive)', () => {
    // Same options as backend/src/main.ts global pipe
    const pipe = new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    it('tierCode survives whitelist on CreateCustomerDto', async () => {
      const out = (await pipe.transform(
        {
          customerType: 'retail',
          name: 'Test Pelanggan',
          phone: '0812999888777',
          tierCode: 'GOLD',
        },
        { type: 'body', metatype: CreateCustomerDto },
      )) as CreateCustomerDto;

      expect(out.tierCode).toBe('GOLD');
    });

    it('tierCode survives whitelist on UpdateCustomerDto', async () => {
      const out = (await pipe.transform(
        { name: 'Test Pelanggan', tierCode: 'GOLD' },
        { type: 'body', metatype: UpdateCustomerDto },
      )) as UpdateCustomerDto;

      expect((out as any).tierCode).toBe('GOLD');
    });
  });
});
