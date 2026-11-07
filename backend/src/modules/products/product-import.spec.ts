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
const { PRODUCT_IMPORT_HEADERS } = require('../../shared/utils/product-import-template');

async function xlsx(headers: string[], rows: any[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  return (await wb.xlsx.writeBuffer()) as Buffer;
}

/** Full 29-col row with defaults; overrides by header label. */
function fullRow(over: Record<string, any> = {}): any[] {
  const base: Record<string, any> = {
    Barcode: 'B-001',
    Item: 'Produk A',
    'Nama Tercetak': 'Produk A Cetak',
    Satuan: 'Pcs',
    Kategori: 'Spare Part',
    Grade: 'Original',
    Merek: 'Merek X',
    Ukuran: 'M',
    Warna: 'Hitam',
    'Harga Reguler': 150000,
    'Harga Member T1': '',
    'Jasa(Y/N)': 'N',
    'SN(1)/Bahan(2)': '2',
    'Harga Modal': 100000,
    Supplier: 'Supplier Y',
    Platinum: 5,
    Gold: 3,
    Silver: 2,
    User: 0,
  };
  const row = PRODUCT_IMPORT_HEADERS.map((h: string) => base[h] ?? over[h] ?? '');
  for (const [k, v] of Object.entries(over)) {
    const i = PRODUCT_IMPORT_HEADERS.indexOf(k);
    if (i >= 0) row[i] = v;
  }
  return row;
}

describe('ProductsService — XLSX product import', () => {
  let service: ProductsService;
  let prisma: any;

  const lookups = () => {
    prisma.category.findMany.mockResolvedValue([{ id: 'cat-1', name: 'Spare Part', code: 'CAT-SP' }]);
    prisma.brand.findMany.mockResolvedValue([{ id: 'brand-1', name: 'Merek X', code: 'BRAND-X' }]);
    prisma.unit.findMany.mockResolvedValue([{ id: 'unit-1', name: 'Pcs' }]);
    prisma.size.findMany.mockResolvedValue([{ id: 'size-1', name: 'M' }]);
    prisma.color.findMany.mockResolvedValue([{ id: 'color-1', name: 'Hitam' }]);
    prisma.warehouse.findMany.mockResolvedValue([
      { id: 'wh-1', name: 'Stok IGD Kalisat - Spare Part' },
    ]);
    prisma.customer.findMany.mockResolvedValue([{ id: 'sup-1', name: 'Supplier Y' }]);
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Spare Part' });
    prisma.brand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'Merek X' });
  };

  beforeEach(async () => {
    prisma = {
      product: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      category: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      brand: { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
      unit: { findMany: jest.fn() },
      size: { findMany: jest.fn() },
      color: { findMany: jest.fn() },
      warehouse: { findMany: jest.fn() },
      customer: { findMany: jest.fn() },
      productStock: { upsert: jest.fn() },
    };
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.product.findFirst.mockResolvedValue(null);
    prisma.product.create.mockImplementation(async ({ data }: any) => ({
      id: 'prod-new',
      ...data,
      category: { id: 'cat-1', code: 'CAT-SP', name: 'Spare Part' },
      brand: { id: 'brand-1', code: 'BRAND-X', name: 'Merek X' },
      productStocks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    }));
    prisma.product.update.mockImplementation(async ({ data }: any) => ({
      id: 'prod-1',
      sku: 'PROD-1',
      barcode: 'B-001',
      name: 'Produk A',
      costPrice: 100000,
      sellingPrice: 150000,
      ...data,
      category: { id: 'cat-1', code: 'CAT-SP', name: 'Spare Part' },
      brand: null,
      productStocks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    }));
    lookups();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<ProductsService>(ProductsService);
  });

  describe('previewProductImport', () => {
    it('resolves ids/names/prices/memberPricing/stocks and stays read-only', async () => {
      const buf = await xlsx(PRODUCT_IMPORT_HEADERS, [
        fullRow({ 'Stok IGD Kalisat - Spare Part': 10 }),
      ]);
      const out = await service.previewProductImport(buf);
      expect(out.errorCount).toBe(0);
      expect(out.validCount).toBe(1);
      const r = out.rows[0];
      expect(r).toMatchObject({
        barcode: 'B-001',
        name: 'Produk A',
        printedName: 'Produk A Cetak',
        categoryId: 'cat-1',
        brandId: 'brand-1',
        unitId: 'unit-1',
        sizeId: 'size-1',
        colorId: 'color-1',
        grade: 'Original',
        sellingPrice: 150000,
        costPrice: 100000,
        isService: false,
        trackSerial: false,
        supplierId: 'sup-1',
        action: 'create',
      });
      expect(r.memberPricing).toEqual({
        platinum: { discount: 5 },
        gold: { discount: 3 },
        silver: { discount: 2 },
        user: { discount: 0 },
      });
      expect(r.stocks).toEqual([
        { warehouseId: 'wh-1', warehouseName: 'Stok IGD Kalisat - Spare Part', quantity: 10 },
      ]);
      // READ-ONLY: no writes of any kind
      expect(prisma.product.create).not.toHaveBeenCalled();
      expect(prisma.product.update).not.toHaveBeenCalled();
      expect(prisma.productStock.upsert).not.toHaveBeenCalled();
      expect(prisma.category.create).not.toHaveBeenCalled();
      expect(prisma.brand.create).not.toHaveBeenCalled();
    });

    it('flags missing prices + unknown unit/size/color, nulls unknown supplier', async () => {
      const buf = await xlsx(PRODUCT_IMPORT_HEADERS, [
        fullRow({ 'Harga Reguler': '', Satuan: 'Lusin', Supplier: ' entah ' }),
      ]);
      const out = await service.previewProductImport(buf);
      expect(out.validCount).toBe(0);
      expect(out.errorCount).toBe(1);
      const errs = out.rows[0].errors.join(' | ');
      expect(errs).toMatch(/Harga Reguler/);
      expect(errs).toMatch(/Satuan/);
      expect(out.rows[0].supplierId).toBeUndefined(); // unknown supplier -> null, no error
    });
  });

  describe('confirmProductImport', () => {
    it('creates a new product (auto SKU, grade passthrough) + upserts stocks', async () => {
      const out = await service.confirmProductImport(
        {
          fileName: 'template-produk.xlsx',
          rows: [
            {
              rowNumbers: [2],
              barcode: 'B-001',
              name: 'Produk A',
              printedName: 'Produk A Cetak',
              categoryId: 'cat-1',
              brandId: 'brand-1',
              unitId: 'unit-1',
              grade: 'Original',
              sellingPrice: 150000,
              costPrice: 100000,
              isService: false,
              trackSerial: false,
              memberPricing: { platinum: { discount: 5 } },
              stocks: [{ warehouseId: 'wh-1', quantity: 10 }],
            },
          ],
        },
        'user-1',
      );
      expect(out).toMatchObject({ created: 1, updated: 0, failed: 0 });
      expect(out.productIds).toEqual(['prod-new']);
      expect(prisma.product.create).toHaveBeenCalledTimes(1);
      const data = prisma.product.create.mock.calls[0][0].data;
      expect(data).toMatchObject({ name: 'Produk A', grade: 'Original', categoryId: 'cat-1' });
      expect(data.sku).toMatch(/^PROD-/); // auto-generated SKU
      expect(prisma.productStock.upsert).toHaveBeenCalledTimes(1);
      expect(prisma.productStock.upsert).toHaveBeenCalledWith({
        where: { productId_warehouseId: { productId: 'prod-new', warehouseId: 'wh-1' } },
        create: { productId: 'prod-new', warehouseId: 'wh-1', quantityAvailable: 10 },
        update: { quantityAvailable: 10 },
      });
    });

    it('updates the existing product matched by barcode', async () => {
      prisma.product.findFirst.mockResolvedValue({ id: 'prod-1' });
      prisma.product.findUnique.mockImplementation(async ({ where }: any) =>
        where.id === 'prod-1'
          ? { id: 'prod-1', sku: 'PROD-1', barcode: 'B-001', sellingPrice: 150000 }
          : null,
      );
      const out = await service.confirmProductImport(
        {
          fileName: 'f.xlsx',
          rows: [
            {
              rowNumbers: [2],
              barcode: 'B-001',
              name: 'Produk A Baru',
              categoryId: 'cat-1',
              sellingPrice: 160000,
              costPrice: 110000,
              stocks: [],
            },
          ],
        },
        'user-1',
      );
      expect(out).toMatchObject({ created: 0, updated: 1, failed: 0 });
      expect(prisma.product.create).not.toHaveBeenCalled();
      expect(prisma.product.update).toHaveBeenCalledTimes(1);
      expect(prisma.productStock.upsert).not.toHaveBeenCalled();
    });

    it('auto-creates an unknown category at confirm time', async () => {
      prisma.category.create.mockResolvedValue({ id: 'cat-new', name: 'Kategori Baru', code: 'CAT-NEW' });
      const out = await service.confirmProductImport(
        {
          fileName: 'f.xlsx',
          rows: [
            {
              rowNumbers: [3],
              name: 'Produk B',
              categoryName: 'Kategori Baru',
              sellingPrice: 50000,
              costPrice: 30000,
              stocks: [],
            },
          ],
        },
        'user-1',
      );
      expect(out).toMatchObject({ created: 1, failed: 0 });
      expect(prisma.category.create).toHaveBeenCalledTimes(1);
    });
  });
});
