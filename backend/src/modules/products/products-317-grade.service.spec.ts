import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { ProductsService } from './products.service';

// Same @prisma/client Decimal stub as products.service.spec.ts (repo has no
// lockfile; fresh installs resolve a client without the Prisma.Decimal
// re-export — stub it so these guard specs run independent of that).
jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  class DecimalStub {
    private v: string;
    constructor(v: any) {
      this.v = String(v);
    }
    toString() {
      return this.v;
    }
    valueOf() {
      return Number(this.v);
    }
    toNumber() {
      return Number(this.v);
    }
  }
  return { ...actual, Prisma: { Decimal: DecimalStub } };
});

import { MASTER_CODE_PATTERN } from '../../common/master-code.util';

/**
 * IGDERP-317 — product gradeId validation (scoped to the product category)
 * + import find-or-create.
 */
describe('ProductsService scoped grade (IGDERP-317)', () => {
  let service: ProductsService;
  let prisma: any;

  const baseDto = (over: any = {}) => ({
    sku: 'PROD-GRADE',
    name: 'Graded Product',
    categoryId: 'cat-1',
    costPrice: 100000,
    sellingPrice: 150000,
    unitId: 'unit-1',
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
      category: { findUnique: jest.fn().mockResolvedValue({ id: 'cat-1' }) },
      categoryGrade: {
        findUnique: jest.fn().mockResolvedValue({ id: 'grade-1', categoryId: 'cat-1', name: 'ORI', isActive: true }),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async (args: any) => ({ id: 'grade-new', name: args?.data?.name })),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ next: 99 }]),
    };
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.product.create.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('create with an in-category active gradeId links it and syncs the grade text', async () => {
    await service.create(baseDto({ gradeId: 'grade-1' }) as any, 'user-1');
    expect(prisma.product.create).toHaveBeenCalled();
    const data = prisma.product.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ gradeId: 'grade-1', grade: 'ORI' });
  });

  it('create rejects a gradeId from another category', async () => {
    prisma.categoryGrade.findUnique.mockResolvedValue({
      id: 'grade-9',
      categoryId: 'cat-2',
      name: 'X',
      isActive: true,
    });
    await expect(service.create(baseDto({ gradeId: 'grade-9' }) as any, 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('create rejects an inactive gradeId', async () => {
    prisma.categoryGrade.findUnique.mockResolvedValue({
      id: 'grade-1',
      categoryId: 'cat-1',
      name: 'ORI',
      isActive: false,
    });
    await expect(service.create(baseDto({ gradeId: 'grade-1' }) as any, 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('create 404s on an unknown gradeId', async () => {
    prisma.categoryGrade.findUnique.mockResolvedValue(null);
    await expect(service.create(baseDto({ gradeId: 'grade-1' }) as any, 'user-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('update validates gradeId against the effective (new) category', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'p1', categoryId: 'cat-1', sku: 'PROD-GRADE' });
    prisma.product.update.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));
    prisma.categoryGrade.findUnique.mockResolvedValue({
      id: 'grade-9',
      categoryId: 'cat-2',
      name: 'X',
      isActive: true,
    });
    // switching product to cat-2 while pointing at cat-2's grade is fine
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-2' });
    const ok = await service.update('p1', { categoryId: 'cat-2', gradeId: 'grade-9' } as any, 'user-1');
    expect((ok as any).gradeId ?? prisma.product.update.mock.calls[0][0].data.gradeId).toBe('grade-9');
    // ...but pointing at cat-1's grade while moving to cat-2 is rejected
    prisma.categoryGrade.findUnique.mockResolvedValue({
      id: 'grade-1',
      categoryId: 'cat-1',
      name: 'ORI',
      isActive: true,
    });
    await expect(service.update('p1', { categoryId: 'cat-2', gradeId: 'grade-1' } as any, 'user-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('findOrCreateGrade returns the existing row, else creates with a 10-char code', async () => {
    prisma.categoryGrade.findFirst.mockResolvedValue({ id: 'grade-1', name: 'ORI', isActive: true });
    await expect(service.findOrCreateGrade('cat-1', 'ori')).resolves.toMatchObject({ id: 'grade-1' });
    expect(prisma.categoryGrade.create).not.toHaveBeenCalled();

    prisma.categoryGrade.findFirst.mockResolvedValue(null);
    prisma.categoryGrade.findUnique.mockResolvedValue(null);
    const created = await service.findOrCreateGrade('cat-1', 'KW');
    expect(created).toMatchObject({ id: 'grade-new', name: 'KW' });
    const code = prisma.categoryGrade.create.mock.calls[0][0].data.code;
    expect(code).toMatch(MASTER_CODE_PATTERN);
  });
});
