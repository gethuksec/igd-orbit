import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { CustomersService } from './customers.service';

/**
 * Customer XLSX export specs (mocked Prisma):
 * header order byte-identical, field mapping (incl. dd/mm/yyyy),
 * and export → parse → preview round-trip with 0 errors.
 */
const ExcelJS = require('exceljs');

const HEADERS = [
  'Kode',
  'Nama',
  'Kontak',
  'Alamat',
  'Tanggal Lahir(dd/mm/yyyy)',
  'Jenis Kelamin(L/P)',
  'Type Customer',
  'Keterangan',
];

describe('CustomersService customer XLSX export (round-trip)', () => {
  let service: CustomersService;
  let prisma: {
    customer: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    customerTier: { findUnique: jest.Mock };
  };

  const customerRow = {
    id: 'cust-1',
    customerCode: 'CUST-001',
    name: 'Budi Santoso',
    phone: '081234567890',
    address: 'Jl. Merdeka No. 1',
    dateOfBirth: new Date('1990-01-15T00:00:00.000Z'),
    gender: 'L',
    customerType: 'retail',
    notes: 'Pelanggan setia',
  };

  beforeEach(async () => {
    prisma = {
      customer: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      customerTier: { findUnique: jest.fn() },
    };
    prisma.customer.findMany.mockResolvedValue([customerRow]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  it('emits headers byte-identical to the template in exact order', async () => {
    const buf = await service.exportCustomersToXlsx();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const headers = (wb.getWorksheet('Import Pelanggan')!.getRow(1).values as any[]).slice(1);
    expect(headers).toEqual(HEADERS);
    expect(wb.getWorksheet('Import Pelanggan')!.rowCount).toBe(2);
  });

  it('maps one customer with dd/mm/yyyy date of birth', async () => {
    const buf = await service.exportCustomersToXlsx();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const values = (wb.getWorksheet('Import Pelanggan')!.getRow(2).values as any[]).slice(1);
    expect(values).toEqual([
      'CUST-001',
      'Budi Santoso',
      '081234567890',
      'Jl. Merdeka No. 1',
      '15/01/1990',
      'L',
      'retail',
      'Pelanggan setia',
    ]);
  });

  it('exports blank date of birth when absent', async () => {
    prisma.customer.findMany.mockResolvedValue([{ ...customerRow, dateOfBirth: null }]);
    const buf = await service.exportCustomersToXlsx();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const values = (wb.getWorksheet('Import Pelanggan')!.getRow(2).values as any[]).slice(1);
    expect(values[4]).toBe('');
  });

  it('round-trips: export → parse → preview yields 0 errors', async () => {
    const buf = await service.exportCustomersToXlsx();
    prisma.customer.findMany.mockResolvedValue([]); // no existing matches
    const out = await service.previewCustomerImport(buf);
    expect(out.errorCount).toBe(0);
    expect(out.validCount).toBe(1);
    expect(out.rows[0]).toMatchObject({
      name: 'Budi Santoso',
      phone: '081234567890',
      dateOfBirth: '1990-01-15',
      gender: 'L',
      customerType: 'retail',
    });
  });
});
