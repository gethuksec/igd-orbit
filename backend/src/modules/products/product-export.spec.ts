import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { ProductsService } from './products.service';

// Same Decimal stub as products.service.spec.ts (repo has no lockfile;
// fresh installs may resolve a client without the Prisma.Decimal re-export).
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

const ExcelJS = require('exceljs');
const {
  PRODUCT_IMPORT_HEADERS,
  PRODUCT_STOCK_LABELS,
} = require('../../shared/utils/product-import-template');

describe('ProductsService — XLSX product export (round-trip)', () => {
  let service: ProductsService;
  let prisma: any;

  const LABEL0 = PRODUCT_STOCK_LABELS[0];
  const LABEL1 = PRODUCT_STOCK_LABELS[1];

  const productRow = {
    id: 'prod-1',
    barcode: 'B-001',
    name: 'Produk A',
    printedName: 'Produk A Cetak',
    category: { id: 'cat-1', name: 'Spare Part' },
    brand: { id: 'brand-1', name: 'Merek X' },
    unit: { id: 'unit-1', name: 'Pcs' },
    size: { id: 'size-1', name: 'M' },
    color: { id: 'color-1', name: 'Hitam' },
    grade: 'Original',
    sellingPrice: 150000,
    costPrice: 100000,
    isService: false,
    trackSerial: false,
    supplier: { id: 'sup-1', name: 'Supplier Y' },
    memberPricing: {
      platinum: { discount: 5 },
      gold: { discount: 3 },
      silver: { discount: 2 },
      user: { discount: 0 },
    },
    productStocks: [{ warehouseId: 'wh-0', quantityAvailable: 10 }],
  };

  const warehouses = [{ id: 'wh-0', name: LABEL0 }, { id: 'wh-1', name: LABEL1 }];

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      category: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      brand: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      unit: { findMany: jest.fn() },
      size: { findMany: jest.fn() },
      color: { findMany: jest.fn() },
      warehouse: { findMany: jest.fn() },
      customer: { findMany: jest.fn() },
      productStock: { upsert: jest.fn() },
    };
    prisma.product.findMany.mockResolvedValue([productRow]);
    prisma.warehouse.findMany.mockResolvedValue(warehouses);
    // Lookups for the round-trip preview against the same DB state.
    prisma.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Spare Part', code: 'CAT-SP' }]);
    prisma.brand.findMany.mockResolvedValue([{ id: 'brand-1', name: 'Merek X', code: 'BRAND-X' }]);
    prisma.unit.findMany.mockResolvedValue([{ id: 'unit-1', name: 'Pcs' }]);
    prisma.size.findMany.mockResolvedValue([{ id: 'size-1', name: 'M' }]);
    prisma.color.findMany.mockResolvedValue([{ id: 'color-1', name: 'Hitam' }]);
    prisma.customer.findMany.mockResolvedValue([{ id: 'sup-1', name: 'Supplier Y' }]);
    prisma.product.findFirst.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ProductsService>(ProductsService);
  });

  it('emits headers byte-identical to the template in exact order', async () => {
    const buf = await service.exportProductsToXlsx();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const headers = (wb.getWorksheet('Data')!.getRow(1).values as any[]).slice(1);
    expect(headers).toEqual(PRODUCT_IMPORT_HEADERS);
    expect(wb.getWorksheet('Data')!.rowCount).toBe(2); // header + 1 product
  });

  it('maps one product with stocks (0 when warehouse exists but has no row, blank when no warehouse)', async () => {
    const buf = await service.exportProductsToXlsx();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const values = (wb.getWorksheet('Data')!.getRow(2).values as any[]).slice(1);
    const byHeader = new Map(PRODUCT_IMPORT_HEADERS.map((h: string, i: number) => [h, values[i]]));
    expect(byHeader.get('Barcode')).toBe('B-001');
    expect(byHeader.get('Item')).toBe('Produk A');
    expect(byHeader.get('Nama Tercetak')).toBe('Produk A Cetak');
    expect(byHeader.get('Satuan')).toBe('Pcs');
    expect(byHeader.get('Kategori')).toBe('Spare Part');
    expect(byHeader.get('Grade')).toBe('Original');
    expect(byHeader.get('Merek')).toBe('Merek X');
    expect(byHeader.get('Ukuran')).toBe('M');
    expect(byHeader.get('Warna')).toBe('Hitam');
    expect(byHeader.get('Harga Reguler')).toBe(150000);
    expect(byHeader.get('Harga Member T1')).toBe('');
    expect(byHeader.get('Jasa(Y/N)')).toBe('N');
    expect(byHeader.get('SN(1)/Bahan(2)')).toBe('2');
    expect(byHeader.get('Harga Modal')).toBe(100000);
    expect(byHeader.get('Supplier')).toBe('Supplier Y');
    expect(byHeader.get('Platinum')).toBe(5);
    expect(byHeader.get('Gold')).toBe(3);
    expect(byHeader.get('Silver')).toBe(2);
    expect(byHeader.get('User')).toBe(0);
    expect(byHeader.get(LABEL0)).toBe(10); // warehouse exists + stock row
    expect(byHeader.get(LABEL1)).toBe(0); // warehouse exists, no stock row
    // Labels with no warehouse match export blank (skipped on re-import).
    expect(byHeader.get(PRODUCT_STOCK_LABELS[2])).toBe('');
  });

  it('round-trips: export → parse → preview yields 0 errors against the same DB', async () => {
    const buf = await service.exportProductsToXlsx();
    const out = await service.previewProductImport(buf);
    expect(out.errorCount).toBe(0);
    expect(out.validCount).toBe(1);
    expect(out.rows[0]).toMatchObject({ name: 'Produk A', sellingPrice: 150000, costPrice: 100000 });
  });
});
