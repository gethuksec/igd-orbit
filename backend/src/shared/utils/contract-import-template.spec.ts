/**
 * IGDERP-298 — contract import-as-intake workbook specs.
 * New 13-column shape (JABATAN* + GRADE* split, TGL MULAI/SELESAI,
 * EMAIL/NO HP, GAJI POKOK*, PENDIDIKAN TERAKHIR*) + 3 reference sheets;
 * legacy payroll headers (LEVEL/SECTOR/TANGGAL MASUK/WAKTU KONTRAK) still parse.
 */
import {
  parseContractImportBuffer,
  excelSerialToDate,
  parseContractImportNumber,
  buildContractImportTemplate,
  normalizeEducation,
  EDUCATION_LEVELS,
  CONTRACT_IMPORT_COLUMNS,
} from './contract-import-template';

const ExcelJS = require('exceljs');

// NAMA* | NIP* | EMAIL | NO HP | JABATAN* | GRADE* | DIVISI |
// JENIS KONTRAK* | TGL MULAI* | TGL SELESAI | AREA | GAJI POKOK* | PENDIDIKAN TERAKHIR*
const HEADERS = [
  'NAMA*',
  'NIP*',
  'EMAIL',
  'NO HP',
  'JABATAN*',
  'GRADE*',
  'DIVISI',
  'JENIS KONTRAK*',
  'TGL MULAI*',
  'TGL SELESAI',
  'AREA',
  'GAJI POKOK*',
  'PENDIDIKAN TERAKHIR*',
];

const NEW_ROW = [
  'BINTANG PERMATA',
  'IGD.23-0008',
  'bintang@igd.local',
  '081234567890',
  'TEKNISI',
  2,
  '',
  'ANNUAL',
  45200,
  46446,
  'BR-001',
  1400000,
  'SMA',
];

async function buildBuffer(dataRows: any[][], headers: string[] = HEADERS): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Payroll');
  ws.addRow(headers);
  for (const r of dataRows) ws.addRow(r);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as any);
}

describe('parseContractImportBuffer (IGDERP-298)', () => {
  it('parses the new 13-column shape', async () => {
    const rows = await parseContractImportBuffer(await buildBuffer([NEW_ROW]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      name: 'BINTANG PERMATA',
      nip: 'IGD.23-0008',
      email: 'bintang@igd.local',
      phone: '081234567890',
      jabatan: 'TEKNISI',
      grade: '2',
      contractTypeRaw: 'ANNUAL',
      startDateRaw: 45200,
      endDateRaw: 46446,
      area: 'BR-001',
      basicSalaryRaw: 1400000,
      education: 'SMA',
    });
  });

  it('still parses legacy payroll headers (LEVEL/SECTOR/TGL MASUK/WAKTU)', async () => {
    const buf = await buildBuffer(
      [[1, 'HQ', 'BINTANG PERMATA', 'ADM/CS-1', 'IGD.23-0008', 'ANNUAL', 46446, 'SALES', 45200, 1400000]],
      ['NO', 'AREA', 'NAMA', 'LEVEL', 'NIP', 'JENIS KONTRAK', 'WAKTU KONTRAK', 'SECTOR', 'TANGGAL MASUK', 'GAJI POKOK'],
    );
    const rows = await parseContractImportBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: 'BINTANG PERMATA',
      nip: 'IGD.23-0008',
      jabatan: 'ADM/CS-1',
      divisi: 'SALES',
      area: 'HQ',
    });
    expect(rows[0].startDateRaw).toBe(45200);
    expect(rows[0].endDateRaw).toBe(46446);
  });

  it('skips blank rows and keeps "-" end-date raw', async () => {
    const buf = await buildBuffer([
      ['SLAMET', 'IGD.19-0004', '', '', 'HEADSTORE (HS)', '', '', 'LIFETIME', 43466, '-', '', 1200000, 'S1'],
      [],
      [],
    ]);
    const rows = await parseContractImportBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].endDateRaw).toBe('-');
    expect(rows[0].startDateRaw).toBe(43466);
  });

  it('matches header aliases without stars (ID/EN variants)', async () => {
    const buf = await buildBuffer([['Eka', 'IGD.26-0001', '', '', 'TEKNISI', '1', '', 'PKWT', 45200, 46446, '', 1000000, 'SMA']], [
      'Nama Karyawan',
      'Kode Karyawan',
      'Email',
      'No HP',
      'Jabatan',
      'Grade',
      'Divisi',
      'Tipe Kontrak',
      'Tanggal Masuk',
      'Kontrak Berakhir',
      'Penempatan',
      'Gaji',
      'Pendidikan',
    ]);
    const rows = await parseContractImportBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Eka', nip: 'IGD.26-0001', jabatan: 'TEKNISI', grade: '1' });
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
    const buf = await buildBuffer([]);
    await expect(parseContractImportBuffer(buf)).rejects.toThrow('Tidak ada baris data');
  });
});

describe('normalizeEducation', () => {
  it('maps jenjang variants to codes', () => {
    expect(normalizeEducation('SMA')).toBe('SMA');
    expect(normalizeEducation('smu')).toBe('SMA');
    expect(normalizeEducation('Sarjana')).toBe('S1');
    expect(normalizeEducation('s1')).toBe('S1');
    expect(normalizeEducation('Diploma 3')).toBe('D3'); // alias covers it
    expect(normalizeEducation('D3')).toBe('D3');
    expect(normalizeEducation('')).toBeNull();
    expect(normalizeEducation('SMPN 1')).toBeNull();
  });

  it('covers the reference sheet codes', () => {
    expect(EDUCATION_LEVELS.map((l) => l.code)).toEqual(['SD', 'SMP', 'SMA', 'SMK', 'D3', 'S1', 'S2', 'S3']);
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
      email: 'bintang@igd.local',
      jabatan: 'TC',
      grade: '2',
      divisi: 'DIV-OPS-SRV',
      startDate: new Date(2023, 9, 1),
      area: 'BR-001',
      basicSalary: 1400000,
      education: 'SMA',
    },
    { name: 'SLAMET TANPA GAJI', nip: 'IGD.19-0004' },
  ];
  it('header row + pre-filled employees + 3 reference sheets, round-trips', async () => {
    const buf = await buildContractImportTemplate(prefill as any, {
      outlets: [{ code: 'BR-001', name: 'IGD Jember Pusat' }],
      titles: [{ code: 'TC', name: 'STAFF TEKNISI', departmentCode: 'DEPT-OPS', divisionCode: 'DIV-OPS-SRV', grades: '1-6' }],
    });
    expect(buf.length).toBeGreaterThan(1000);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    expect(wb.worksheets.map((s: any) => s.name)).toEqual([
      'Payroll',
      'Daftar Outlet',
      'Daftar Jabatan',
      'Daftar Pendidikan',
    ]);
    const payroll = wb.getWorksheet('Payroll');
    expect(payroll).toBeDefined();
    const labels = CONTRACT_IMPORT_COLUMNS.map((c) => c.label);
    expect(labels.filter((l) => l.endsWith('*'))).toHaveLength(8);
    const headerCells: string[] = [];
    payroll!.getRow(1).eachCell((cell: any) => headerCells.push(String(cell.value)));
    expect(headerCells).toEqual(labels);
    expect(payroll!.rowCount).toBe(3);
    expect(String(payroll!.getRow(2).getCell(2).value)).toBe('IGD.23-0008');
    // Required headers are styled red (mandatory-marked).
    const requiredIdx = labels.findIndex((l) => l === 'NAMA*');
    expect(payroll!.getRow(1).getCell(requiredIdx + 1).font).toMatchObject({ color: { argb: 'FFFF0000' } });
    // Pre-filled rows parse back.
    const parsed = await parseContractImportBuffer(buf);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      name: 'BINTANG PERMATA',
      nip: 'IGD.23-0008',
      email: 'bintang@igd.local',
      jabatan: 'TC',
      grade: '2',
      basicSalaryRaw: 1400000,
      education: 'SMA',
    });
    expect(parsed[1].basicSalaryRaw).toBe('');
  });

  it('headers-only template parses to the friendly empty error', async () => {
    const buf = await buildContractImportTemplate([]);
    await expect(parseContractImportBuffer(buf)).rejects.toThrow('Tidak ada baris data');
  });
});
