import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import {
  ProductsService,
  buildProductBarcode,
  PRODUCT_BARCODE_RE,
} from './products.service';

// IGDERP-309 — 12-digit numeric barcode (DDMMYYYY + lifetime sequence).
describe('ProductsService — barcode 12-digit lifetime (IGDERP-309)', () => {
  let service: ProductsService;
  let prisma: any;

  const baseDto = (over: any = {}) => ({
    name: 'Test Product',
    categoryId: 'cat-1',
    costPrice: 10000,
    sellingPrice: 15000,
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      category: { findUnique: jest.fn() },
      $queryRaw: jest.fn(),
    };
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1' });
    prisma.product.create.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));
    prisma.product.update.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));
    // Lifetime sequence: first value consumed is 1
    prisma.$queryRaw.mockResolvedValue([{ next: 1 }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ProductsService>(ProductsService);
  });

  it('builds the user example shape: 31072016 + 0001', () => {
    // 31 Jul 2016 10:00 WIB, first lifetime sequence
    const at = new Date('2016-07-31T10:00:00+07:00');
    expect(buildProductBarcode(at, 1)).toBe('310720160001');
  });

  it('pads the sequence to 4 digits and grows past 9999', () => {
    const at = new Date('2026-11-25T10:00:00+07:00');
    expect(buildProductBarcode(at, 42)).toBe('251120260042');
    expect(buildProductBarcode(at, 12345)).toBe('2511202612345');
    expect(buildProductBarcode(at, 12345)).toHaveLength(13);
  });

  it('matches the 12-digit scheme regex', () => {
    expect(PRODUCT_BARCODE_RE.test('310720160001')).toBe(true);
    expect(PRODUCT_BARCODE_RE.test('BRC-251125-1234')).toBe(false);
    expect(PRODUCT_BARCODE_RE.test('12345678901')).toBe(false); // 11 digits
  });

  it('create auto-generates a barcode when none is provided', async () => {
    const p: any = await service.create(baseDto() as any, 'user-1');
    expect(prisma.$queryRaw).toHaveBeenCalled();
    expect(p.barcode).toHaveLength(12);
    expect(p.barcode).toMatch(/^\d{8}0001$/); // date prefix + first sequence
  });

  it('create keeps a conforming provided barcode (no sequence consumed)', async () => {
    const p: any = await service.create(baseDto({ barcode: '310720160042' }) as any, 'user-1');
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(p.barcode).toBe('310720160042');
  });

  it('create rejects a legacy-format barcode', async () => {
    await expect(
      service.create(baseDto({ barcode: 'BRC-251125-1234' }) as any, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  it('update accepts an unchanged legacy barcode but rejects changing to one', async () => {
    // Unchanged legacy value (pre-backfill row edited for price only) passes through
    prisma.product.findUnique.mockResolvedValueOnce({
      id: 'p1',
      sku: 'S-1',
      barcode: 'BRC-OLD',
      sellingPrice: 15000,
      minSellingPrice: null,
    });
    await service.update('p1', { sellingPrice: 16000 } as any, 'user-1');
    expect(prisma.product.update).toHaveBeenCalled();

    // Changing the barcode to a legacy value is rejected
    prisma.product.findUnique.mockResolvedValueOnce({
      id: 'p1',
      sku: 'S-1',
      barcode: '310720160001',
      sellingPrice: 15000,
      minSellingPrice: null,
    });
    await expect(
      service.update('p1', { barcode: 'B-1' } as any, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generateBarcode surfaces a clear error when the sequence is missing', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('relation "product_barcode_seq" does not exist'));
    await expect(service.generateBarcode()).rejects.toBeInstanceOf(BadRequestException);
  });
});
