import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { CustomersService } from './customers.service';

/**
 * Customer XLSX import specs (mocked Prisma):
 * preview is read-only, confirm routes through create()/update().
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

async function toBuffer(rows: any[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Import Pelanggan');
  ws.addRow(HEADERS);
  for (const r of rows) ws.addRow(r);
  return (await wb.xlsx.writeBuffer()) as Buffer;
}

describe('CustomersService customer XLSX import', () => {
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  function mockCreateOk(id = 'cust-new') {
    prisma.customer.findUnique.mockResolvedValue(null);
    prisma.customer.findFirst.mockResolvedValue(null);
    prisma.customer.create.mockImplementation(async ({ data }: any) => ({
      id,
      ...data,
      tier: null,
      preferredBranch: null,
      creditLimit: { toNumber: () => data.creditLimit ?? 0 },
      creditUsed: { toNumber: () => 0 },
      createdAt: new Date(),
    }));
  }

  function mockUpdateOk(id: string, phone: string) {
    prisma.customer.update.mockImplementation(async ({ data }: any) => ({
      id,
      customerCode: 'CUST-X',
      customerType: 'retail',
      name: 'Updated',
      email: null,
      phone: data.phone ?? phone,
      subdistrict: null,
      tier: null,
      creditLimit: { toNumber: () => 0 },
      creditUsed: { toNumber: () => 0 },
      isBlacklisted: false,
      isActive: true,
      updatedAt: new Date(),
    }));
  }

  describe('previewCustomerImport (read-only)', () => {
    it('flags valid rows and performs no writes', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      const buf = await toBuffer([
        ['', 'Budi', '081234567890', 'Jl. A', '15/01/1990', 'L', 'retail', 'x'],
      ]);
      const res = await service.previewCustomerImport(buf);
      expect(res.validCount).toBe(1);
      expect(res.errorCount).toBe(0);
      expect(res.rows[0]).toMatchObject({
        rowNumber: 2,
        name: 'Budi',
        phone: '081234567890',
        dateOfBirth: '1990-01-15',
        gender: 'L',
        customerType: 'retail',
        isUpdate: false,
        errors: [],
      });
      expect(prisma.customer.create).not.toHaveBeenCalled();
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });

    it('marks rows matching existing phone/code as updates', async () => {
      prisma.customer.findMany.mockImplementation(async ({ where }: any) => {
        if (where.phone) return [{ id: 'cust-1', phone: '081234567890' }];
        if (where.customerCode) return [{ id: 'cust-2', customerCode: 'C-9' }];
        return [];
      });
      const buf = await toBuffer([
        ['', 'Budi', '081234567890', '', '', '', '', ''],
        ['C-9', 'Baru', '081999999999', '', '', '', '', ''],
        ['', 'Baru2', '081888888888', '', '', '', '', ''],
      ]);
      const res = await service.previewCustomerImport(buf);
      expect(res.rows.map((r) => r.isUpdate)).toEqual([true, true, false]);
      expect(res.validCount).toBe(3);
    });

    it('reports phone/date/gender/type errors per row', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      const buf = await toBuffer([
        ['', 'Bad Phone', '123', '', '', '', '', ''],
        ['', 'Bad Date', '081234567890', '', '31/02/2020', '', '', ''],
        ['', 'Bad Gender', '081234567891', '', '', 'X', '', ''],
        ['', 'Bad Type', '081234567892', '', '', '', 'gold', ''],
      ]);
      const res = await service.previewCustomerImport(buf);
      expect(res.validCount).toBe(0);
      expect(res.errorCount).toBe(4);
      expect(res.rows[0].errors.join(' ')).toMatch(/Kontak/);
      expect(res.rows[1].errors.join(' ')).toMatch(/Tanggal Lahir/);
      expect(res.rows[2].errors.join(' ')).toMatch(/Jenis Kelamin/);
      expect(res.rows[3].errors.join(' ')).toMatch(/Type Customer/);
    });

    it('defaults empty type to retail and accepts case-insensitive types', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      const buf = await toBuffer([
        ['', 'A', '081234567890', '', '', '', '', ''],
        ['', 'B', '081234567891', '', '', '', 'WHOLESALE', ''],
        ['', 'C', '081234567892', '', '', '', 'Corporate', ''],
      ]);
      const res = await service.previewCustomerImport(buf);
      expect(res.rows.map((r) => r.customerType)).toEqual([
        'retail',
        'wholesale',
        'corporate',
      ]);
      expect(res.errorCount).toBe(0);
    });

    it('rejects workbooks missing Nama/Kontak columns', async () => {
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Import Pelanggan');
      ws.addRow(['Kode', 'Alamat']);
      ws.addRow(['C-1', 'Jl. A']);
      const buf = (await wb.xlsx.writeBuffer()) as Buffer;
      await expect(service.previewCustomerImport(buf)).rejects.toThrow();
    });
  });

  describe('confirmCustomerImport', () => {
    it('creates new customers via create()', async () => {
      mockCreateOk();
      const res = await service.confirmCustomerImport(
        {
          fileName: 'import.xlsx',
          rows: [
            {
              rowNumbers: [2],
              name: 'Budi',
              phone: '081234567890',
              customerType: 'retail',
            },
          ],
        },
        'user-1',
      );
      expect(res).toMatchObject({ created: 1, updated: 0, failed: 0 });
      expect(res.customerIds).toHaveLength(1);
      expect(prisma.customer.create).toHaveBeenCalled();
    });

    it('updates the existing customer matched by phone', async () => {
      prisma.customer.findFirst.mockResolvedValue({
        id: 'cust-1',
        phone: '081234567890',
      });
      prisma.customer.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.id === 'cust-1') return { id: 'cust-1', phone: '081234567890' };
        return null;
      });
      mockUpdateOk('cust-1', '081234567890');
      const res = await service.confirmCustomerImport(
        {
          fileName: 'import.xlsx',
          rows: [
            {
              rowNumbers: [2],
              name: 'Budi Baru',
              phone: '081234567890',
              customerType: 'retail',
            },
          ],
        },
        'user-1',
      );
      expect(res).toMatchObject({ created: 0, updated: 1, failed: 0 });
      expect(res.customerIds).toEqual(['cust-1']);
      expect(prisma.customer.create).not.toHaveBeenCalled();
    });

    it('prefers customerCode match over phone match', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'cust-2',
        customerCode: 'C-9',
        phone: '081000000000',
      });
      mockUpdateOk('cust-2', '081234567890');
      const res = await service.confirmCustomerImport(
        {
          fileName: 'import.xlsx',
          rows: [
            {
              rowNumbers: [3],
              customerCode: 'C-9',
              name: 'Via Kode',
              phone: '081234567890',
              customerType: 'wholesale',
            },
          ],
        },
        'user-1',
      );
      expect(res).toMatchObject({ created: 0, updated: 1, failed: 0 });
      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'cust-2' } }),
      );
    });

    it('reports per-row failures without throwing', async () => {
      mockCreateOk();
      const res = await service.confirmCustomerImport(
        {
          fileName: 'import.xlsx',
          rows: [
            {
              rowNumbers: [2],
              name: 'Ok',
              phone: '081234567890',
              customerType: 'retail',
            },
            { rowNumbers: [3], name: 'Bad', phone: 'not-a-phone' },
          ],
        },
        'user-1',
      );
      expect(res).toMatchObject({ created: 1, updated: 0, failed: 1 });
      expect(res.errors).toHaveLength(1);
      expect(res.errors[0].row).toBe(3);
    });

    it('throws on empty rows', async () => {
      await expect(
        service.confirmCustomerImport({ fileName: 'x.xlsx', rows: [] }, 'user-1'),
      ).rejects.toThrow(/Tidak ada baris/);
    });
  });
});
