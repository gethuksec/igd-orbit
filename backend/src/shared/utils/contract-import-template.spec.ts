/**
 * IGDERP-271 — payroll-sheet contract import parser specs.
 * Builds workbooks in-memory mirroring Format_HR_ORBIT.xlsx (Payroll):
 * row 1 = merged group labels, row 2 = real headers, data from row 3.
 */
import {
  parseContractImportBuffer,
  excelSerialToDate,
  parseContractImportNumber,
  buildContractImportTemplate,
  CONTRACT_IMPORT_COLUMNS,
} from './contract-import-template';

const ExcelJS = require('exceljs');

const HEADERS = [
  'NO',
  'AREA',
  'NAMA',
  'LEVEL',
  'NIP',
  'JENIS KONTRAK',
  'WAKTU KONTRAK',
  'SECTOR',
  'TANGGAL MASUK',
  'GAJI POKOK',
  'NETT THP',
  'REKENING PAYROLL',
];

async function buildPayrollBuffer(dataRows: any[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Payroll');
  ws.addRow(['BY MONTHS', 'MASA KERJA', '', '', '', '', '', '', '', '', '', '']);
  ws.addRow(HEADERS);
  for (const r of dataRows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as any);
}

describe('parseContractImportBuffer (IGDERP-271)', () => {
  it('finds real headers below group labels and parses payroll rows', async () => {
    const buf = await buildPayrollBuffer([
      [1, 'HQ', 'BINTANG PERMATA', 'ADM/CS-1', 'IGD.23-0008', 'ANNUAL', 46446, 'SALES', 45200, 1400000, 3515000, '3340587722'],
    ]);
    const rows = await parseContractImportBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 3,
      name: 'BINTANG PERMATA',
      nip: 'IGD.23-0008',
      level: 'ADM/CS-1',
      sector: 'SALES',
      area: 'HQ',
    });
    expect(rows[0].contractTypeRaw).toBe('ANNUAL');
    expect(rows[0].hireDateRaw).toBe(45200);
    expect(rows[0].basicSalaryRaw).toBe(1400000);
  });

  it('skips blank rows and keeps "-" contract time raw', async () => {
    const buf = await buildPayrollBuffer([
      [2, 'IGD JBR SRV', 'SLAMET', 'HEADSTORE (HS)', 'IGD.19-0004', 'LIFETIME', '-', 'SRV & SLS', 43466, 1200000, 5000000, '2000976779'],
      [],
      [],
    ]);
    const rows = await parseContractImportBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].contractTimeRaw).toBe('-');
    expect(rows[0].hireDateRaw).toBe(43466);
  });

  it('matches header aliases (ID/EN variants)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Payroll');
    ws.addRow(['Nama Karyawan', 'Kode Karyawan', 'Jabatan', 'Tipe Kontrak']);
    ws.addRow(['Eka', 'IGD.26-0001', 'TEKNISI-1', 'PKWT']);
    const buf = Buffer.from((await wb.xlsx.writeBuffer()) as any);
    const rows = await parseContractImportBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Eka');
    expect(rows[0].nip).toBe('IGD.26-0001');
  });

  it('throws when NAMA/NIP headers are absent', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.addRow(['FOO', 'BAR']);
    ws.addRow(['x', 'y']);
    const buf = Buffer.from((await wb.xlsx.writeBuffer()) as any);
    await expect(parseContractImportBuffer(buf)).rejects.toThrow('NAMA / NIP');
  });

  it('throws on empty data', async () => {
    const buf = await buildPayrollBuffer([]);
    await expect(parseContractImportBuffer(buf)).rejects.toThrow('Tidak ada baris data');
  });
});

describe('excelSerialToDate', () => {
  it('converts serials (46446 -> 2027-02-28, 45200 -> 2023-10-01)', () => {
    expect(excelSerialToDate(46446)!.toISOString().slice(0, 10)).toBe('2027-02-28');
    expect(excelSerialToDate(45200)!.toISOString().slice(0, 10)).toBe('2023-10-01');
  });

  it('passes Date through, "-" and junk to null', () => {
    const d = new Date('2026-05-01T00:00:00Z');
    expect(excelSerialToDate(d)).toBe(d);
    expect(excelSerialToDate('-')).toBeNull();
    expect(excelSerialToDate('')).toBeNull();
    expect(excelSerialToDate('not a date')).toBeNull();
  });
});

describe('parseContractImportNumber', () => {
  it('parses ID/EN formats', () => {
    expect(parseContractImportNumber(1400000)).toBe(1400000);
    expect(parseContractImportNumber('1.400.000')).toBe(1400000);
    expect(parseContractImportNumber('1400000')).toBe(1400000);
    expect(parseContractImportNumber('-')).toBeNull();
    expect(parseContractImportNumber('')).toBeNull();
  });
});

describe('buildContractImportTemplate', () => {
  const prefill = [
    {
      name: 'BINTANG PERMATA',
      nip: 'IGD.23-0008',
      level: 'TEKNISI-2',
      sector: 'SERVICE',
      hireDate: new Date(2023, 9, 1),
      area: 'BR-001',
      basicSalary: 1400000,
    },
    { name: 'SLAMET TANPA GAJI', nip: 'IGD.19-0004' },
  ];
  it('single header row + pre-filled employees, round-trips through the parser', async () => {
    const buf = await buildContractImportTemplate(prefill);
    expect(buf.length).toBeGreaterThan(1000);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    expect(wb.worksheets.length).toBe(1);
    const payroll = wb.getWorksheet('Payroll');
    expect(payroll).toBeDefined();
    const labels = CONTRACT_IMPORT_COLUMNS.map((c) => c.label);
    const headerCells: string[] = [];
    payroll!.getRow(1).eachCell((cell: any) => headerCells.push(String(cell.value)));
    expect(headerCells).toEqual(labels);
    // Header fill sits on row 1 (not offset to a second row).
    expect(payroll!.getRow(1).fill).toBeDefined();
    expect(payroll!.rowCount).toBe(3);
    expect(String(payroll!.getRow(2).getCell(2).value)).toBe('IGD.23-0008');
    // Pre-filled rows parse back; JENIS/WAKTU blank for HR.
    const parsed = await parseContractImportBuffer(buf);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      name: 'BINTANG PERMATA',
      nip: 'IGD.23-0008',
      level: 'TEKNISI-2',
      basicSalaryRaw: 1400000,
    });
    expect(parsed[1].basicSalaryRaw).toBe('');
  });

  it('headers-only template parses to the friendly empty error', async () => {
    const buf = await buildContractImportTemplate([]);
    await expect(parseContractImportBuffer(buf)).rejects.toThrow('Tidak ada baris data');
  });
});
