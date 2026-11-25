import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CustomersService } from './customers.service';

jest.mock('exceljs', () => ({}), { virtual: true });

const SUPPLIER_CODE_RE = /^[A-Z0-9]{10}$/;

/**
 * IGDERP-312 — wholesale (supplier) auto-codes are 10-char alphanumeric;
 * retail/corporate keep the CUST- prefix.
 */
describe('CustomersService supplier codes (IGDERP-312)', () => {
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

    // No collisions by default
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.findFirst.mockResolvedValue(null);
    prisma.customer.create.mockImplementation(async ({ data }: any) => ({
      id: 'cust-1',
      ...data,
      tier: null,
      preferredBranch: null,
      creditLimit: { toNumber: () => data.creditLimit ?? 0 },
      creditUsed: { toNumber: () => 0 },
      createdAt: new Date(),
    }));
  });

  it('generateSupplierCode produces 10-char alphanumeric codes', async () => {
    const code = await service.generateSupplierCode();
    expect(code).toMatch(SUPPLIER_CODE_RE);
  });

  it('retries generateSupplierCode on collision, throws after 10', async () => {
    prisma.customer.findUnique
      .mockResolvedValueOnce({ id: 'taken' })
      .mockResolvedValue(null);
    expect(await service.generateSupplierCode()).toMatch(SUPPLIER_CODE_RE);

    prisma.customer.findUnique.mockReset();
    prisma.customer.findUnique.mockResolvedValue({ id: 'taken' });
    await expect(service.generateSupplierCode()).rejects.toThrow(
      BadRequestException,
    );
  });

  it('auto-assigns a 10-char code when creating a wholesale supplier without code', async () => {
    const result = await service.create(
      { customerType: 'wholesale', name: 'PT Maju', phone: '0812000111222' } as any,
      'user-1',
    );
    expect(result.customerCode).toMatch(SUPPLIER_CODE_RE);
  });

  it('keeps CUST- prefix for retail auto-codes', async () => {
    const result = await service.create(
      { customerType: 'retail', name: 'Budi', phone: '0812999888777' } as any,
      'user-1',
    );
    expect(result.customerCode).toMatch(/^CUST-/);
  });
});
