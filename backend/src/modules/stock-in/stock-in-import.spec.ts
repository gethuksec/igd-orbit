/**
 * IGDERP-97 (I4) — Stock In import specs (preview / confirm / audit).
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockInService, NO_SUPPLIER } from './stock-in.service';

const ExcelJS = require('exceljs');

async function xlsx(headers: string[], rows: any[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  return (await wb.xlsx.writeBuffer()) as Buffer;
}

describe('StockInService import (IGDERP-97)', () => {
  let service: StockInService;
  let prisma: any;
  let tx: any;

  const outlet = { id: 'outlet-1', name: 'Kalisat', code: 'KLS' };
  const goodWarehouse = {
    id: 'wh-1', code: 'KLS-GDG', name: 'Kalisat – Gudang',
    type: 'GOOD', scope: 'OUTLET', outletId: 'outlet-1', isActive: true,
  };
  const product = {
    id: 'prod-1', name: 'iPhone 15', sku: 'IP15-128', barcode: '899IP15',
    sellingPrice: new Decimal(12000), minSellingPrice: new Decimal(10000),
    unitId: 'unit-1', unit: { id: 'unit-1', name: 'pcs' },
  };

  beforeEach(async () => {
    tx = {
      stockIn: {
        create: jest.fn().mockImplementation(async (args: any) => ({ id: 'stockin-1', ...args.data })),
        update: jest.fn().mockImplementation(async (args: any) => ({ id: 'stockin-1', ...args.data, items: [] })),
      },
      productStock: {
        findUnique: jest.fn().mockResolvedValue({ quantityAvailable: new Decimal(50) }),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      branch: { findUnique: jest.fn().mockResolvedValue(outlet) },
      warehouse: { findUnique: jest.fn().mockResolvedValue(goodWarehouse) },
      product: { findMany: jest.fn().mockResolvedValue([product]) },
      stockImportLog: { create: jest.fn().mockImplementation(async (a: any) => ({ id: 'log-1', ...a.data })) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [StockInService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get<StockInService>(StockInService);
  });

  describe('previewImport (read-only)', () => {
    it('merges duplicate SKU rows, summing quantities', async () => {
      const buf = await xlsx(['SKU', 'Qty'], [['IP15-128', 3], ['IP15-128', 2]]);
      const res = await service.previewImport(buf);
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0]).toMatchObject({ productId: 'prod-1', quantity: 5, merged: true });
      expect(res.validCount).toBe(1);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('resolves by barcode and flags unknown products', async () => {
      const buf = await xlsx(['Barcode', 'Qty'], [['899IP15', 1], ['NOPE-999', 1]]);
      const res = await service.previewImport(buf);
      expect(res.validCount).toBe(1);
      expect(res.errorCount).toBe(1);
      expect(res.rows[1].errors.join(' ')).toMatch(/tidak ditemukan/);
    });

    it('flags invalid quantities without writing', async () => {
      const buf = await xlsx(['SKU', 'Qty'], [['IP15-128', 'abc'], ['IP15-128', 0]]);
      const res = await service.previewImport(buf);
      // same product merges into one group; both rows invalid
      expect(res.validCount).toBe(0);
      expect(res.rows[0].errors.length).toBeGreaterThan(0);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects structural problems as BadRequest', async () => {
      const buf = await xlsx(['Nama Produk'], [['x']]);
      await expect(service.previewImport(buf)).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmImport', () => {
    const rows = [{ productId: 'prod-1', quantity: 5, stockValue: 10000 }];

    it('TAMBAH delegates to the manual create path + SUCCESS audit log', async () => {
      const spy = jest.spyOn(service, 'create').mockResolvedValue({ id: 'doc-9' } as any);
      const res = await service.confirmImport(
        { outletId: 'outlet-1', warehouseId: 'wh-1', mode: 'TAMBAH', fileName: 'in.xlsx', rows } as any,
        'user-1',
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toMatchObject({ outletId: 'outlet-1', supplierId: NO_SUPPLIER });
      expect(res.skipped).toEqual([]);
      expect(prisma.stockImportLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS', referenceId: 'doc-9' }) }),
      );
    });

    it('REPLACE sets absolute quantities (not increments)', async () => {
      const res = await service.confirmImport(
        { outletId: 'outlet-1', warehouseId: 'wh-1', mode: 'REPLACE', fileName: 'in.xlsx', rows } as any,
        'user-1',
      );
      expect(tx.productStock.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { quantityAvailable: expect.any(Decimal) } }),
      );
      const qty = tx.productStock.update.mock.calls[0][0].data.quantityAvailable;
      expect(Number(qty)).toBe(5); // file qty, not 50 + 5
      expect(tx.stockMovement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes: expect.stringContaining('REPLACE') }),
        }),
      );
      expect((res.doc as any).id).toBe('stockin-1');
    });

    it('writes a FAILED audit log and rethrows on error', async () => {
      jest.spyOn(service, 'create').mockRejectedValue(new BadRequestException('boom'));
      await expect(
        service.confirmImport(
          { outletId: 'outlet-1', warehouseId: 'wh-1', mode: 'TAMBAH', fileName: 'in.xlsx', rows } as any,
          'user-1',
        ),
      ).rejects.toThrow('boom');
      expect(prisma.stockImportLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
    });
  });

  describe('exportSnapshot', () => {
    it('returns xlsx with the template columns', async () => {
      (prisma as any).productStock = {
        findMany: jest.fn().mockResolvedValue([
          { quantityAvailable: new Decimal(7), product },
        ]),
      };
      const { buffer, filename } = await service.exportSnapshot('wh-1');
      expect(filename).toMatch(/\.xlsx$/);
      expect(buffer.slice(0, 2).toString()).toBe('PK'); // zip magic
    });
  });
});
