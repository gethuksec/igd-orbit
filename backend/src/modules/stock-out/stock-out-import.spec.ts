/**
 * IGDERP-97 (I4) — Stock Out import specs (preview over-qty / skip / audit).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockOutService } from './stock-out.service';

const ExcelJS = require('exceljs');

async function xlsx(headers: string[], rows: any[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  return (await wb.xlsx.writeBuffer()) as Buffer;
}

describe('StockOutService import (IGDERP-97)', () => {
  let service: StockOutService;
  let prisma: any;
  let tx: any;

  const goodWarehouse = {
    id: 'wh-1', code: 'KLS-GDG', name: 'Kalisat – Gudang',
    type: 'GOOD', scope: 'OUTLET', outletId: 'outlet-1', isActive: true,
  };
  const product = {
    id: 'prod-1', name: 'iPhone 15', sku: 'IP15-128', barcode: null,
    sellingPrice: new Decimal(12000), minSellingPrice: new Decimal(10000),
    unitId: 'unit-1', unit: { id: 'unit-1', name: 'pcs' },
  };

  beforeEach(async () => {
    tx = {
      stockOut: {
        create: jest.fn().mockImplementation(async (args: any) => ({ id: 'stockout-1', ...args.data })),
        update: jest.fn().mockImplementation(async (args: any) => ({ id: 'stockout-1', ...args.data, items: [] })),
      },
      stockOutItem: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      productStock: {
        findUnique: jest.fn().mockResolvedValue({ quantityAvailable: new Decimal(50) }),
        update: jest.fn().mockResolvedValue({}),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      warehouse: { findUnique: jest.fn().mockResolvedValue(goodWarehouse) },
      product: { findMany: jest.fn().mockResolvedValue([product]) },
      productStock: {
        findMany: jest.fn().mockResolvedValue([{ productId: 'prod-1', quantityAvailable: new Decimal(5) }]),
      },
      stockImportLog: { create: jest.fn().mockImplementation(async (a: any) => ({ id: 'log-1', ...a.data })) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [StockOutService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<StockOutService>(StockOutService);
  });

  describe('previewImport', () => {
    it('flags over-qty rows against merged totals (read-only)', async () => {
      const buf = await xlsx(['SKU', 'Qty'], [['IP15-128', 3], ['IP15-128', 4]]);
      const res = await service.previewImport(buf, 'wh-1');
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0]).toMatchObject({ quantity: 7, available: 5, overQty: true });
      expect(res.validCount).toBe(0);
      expect(res.overQtyCount).toBe(1);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('passes rows within availability', async () => {
      const buf = await xlsx(['SKU', 'Qty'], [['IP15-128', 2]]);
      const res = await service.previewImport(buf, 'wh-1');
      expect(res.validCount).toBe(1);
      expect(res.rows[0].overQty).toBe(false);
    });
  });

  describe('confirmImport', () => {
    it('TAMBAH imports valid rows and reports skipped per product (PARTIAL log)', async () => {
      const spy = jest.spyOn(service, 'create').mockResolvedValue({ id: 'doc-7' } as any);
      prisma.productStock.findMany.mockResolvedValue([
        { productId: 'prod-1', quantityAvailable: new Decimal(10) },
        { productId: 'prod-2', quantityAvailable: new Decimal(1) },
      ]);
      const res = await service.confirmImport(
        {
          outletId: 'outlet-1', warehouseId: 'wh-1', mode: 'TAMBAH', fileName: 'out.xlsx',
          rows: [
            { productId: 'prod-1', quantity: 4 },
            { productId: 'prod-2', quantity: 5 },
          ],
        } as any,
        'user-1',
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].items).toHaveLength(1);
      expect(spy.mock.calls[0][0].items[0]).toMatchObject({ productId: 'prod-1', quantity: 4 });
      expect(res.skipped).toHaveLength(1);
      expect(res.skipped[0]).toMatchObject({ productId: 'prod-2', available: 1 });
      expect(prisma.stockImportLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'PARTIAL', skippedRows: 1 }) }),
      );
    });

    it('throws + FAILED log when every row is over-qty', async () => {
      prisma.productStock.findMany.mockResolvedValue([
        { productId: 'prod-1', quantityAvailable: new Decimal(0) },
      ]);
      await expect(
        service.confirmImport(
          {
            outletId: 'outlet-1', warehouseId: 'wh-1', mode: 'TAMBAH', fileName: 'out.xlsx',
            rows: [{ productId: 'prod-1', quantity: 5 }],
          } as any,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.stockImportLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
    });

    it('REPLACE reduces surplus down to the file target', async () => {
      prisma.productStock.findMany.mockResolvedValue([
        { productId: 'prod-1', quantityAvailable: new Decimal(50) }, // surplus 45
        { productId: 'prod-2', quantityAvailable: new Decimal(2) }, // below target -> skip
      ]);
      const res = await service.confirmImport(
        {
          outletId: 'outlet-1', warehouseId: 'wh-1', mode: 'REPLACE', fileName: 'out.xlsx',
          rows: [
            { productId: 'prod-1', quantity: 5 },
            { productId: 'prod-2', quantity: 9 },
          ],
        } as any,
        'user-1',
      );
      const qty = tx.productStock.update.mock.calls[0][0].data.quantityAvailable;
      expect(Number(qty)).toBe(5); // reduced to target
      expect(tx.stockOutItem.create).toHaveBeenCalledTimes(1);
      expect(res.skipped).toHaveLength(1);
      expect(res.skipped[0].productId).toBe('prod-2');
    });
  });
});
