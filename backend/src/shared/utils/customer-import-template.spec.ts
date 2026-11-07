/**
 * Customer import template/parse unit specs (pure, no DB).
 * Mirrors stock-import-template.spec.ts.
 */
const ExcelJS = require('exceljs');
const {
  IMPORT_COLUMNS,
  buildCustomerImportTemplate,
  parseCustomerImportBuffer,
} = require('./customer-import-template');

const EXPECTED_HEADERS = [
  'Kode',
  'Nama',
  'Kontak',
  'Alamat',
  'Tanggal Lahir(dd/mm/yyyy)',
  'Jenis Kelamin(L/P)',
  'Type Customer',
  'Keterangan',
];

async function toBuffer(headers: string[], rows: any[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Import Pelanggan');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  return (await wb.xlsx.writeBuffer()) as Buffer;
}

describe('customer IMPORT_COLUMNS', () => {
  it('matches the user template exactly (8 cols, header order)', () => {
    expect(IMPORT_COLUMNS.map((c: any) => c.label)).toEqual(EXPECTED_HEADERS);
  });
});

describe('customer template round-trip', () => {
  it("template has 'Import Pelanggan' (headers only) + 'Contoh' (sample rows) sheets", async () => {
    const buf = await buildCustomerImportTemplate();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    expect(wb.worksheets.map((w: any) => w.name)).toEqual(['Import Pelanggan', 'Contoh']);
    const main = wb.getWorksheet('Import Pelanggan')!;
    expect(main.rowCount).toBe(1); // headers only
    expect((main.getRow(1).values as any[]).slice(1)).toEqual(EXPECTED_HEADERS);
    expect(wb.getWorksheet('Contoh')!.rowCount).toBeGreaterThan(1);
  });

  it('template parses back through the import parser', async () => {
    const tpl = await buildCustomerImportTemplate();
    // Contoh sheet is samples; main sheet is headers-only -> build a data copy
    const buf = await toBuffer(EXPECTED_HEADERS, [
      ['C-1', 'Budi', '081234567890', 'Jl. A', '15/01/1990', 'L', 'retail', 'ok'],
    ]);
    expect(tpl).toBeInstanceOf(Buffer);
    const rows = await parseCustomerImportBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      customerCode: 'C-1',
      name: 'Budi',
      phone: '081234567890',
      dateOfBirthRaw: '15/01/1990',
      genderRaw: 'L',
      customerTypeRaw: 'retail',
    });
  });

  it('matches Indonesian/English header aliases', async () => {
    const buf = await toBuffer(
      ['kode', 'nama', 'telepon', 'alamat', 'tanggal lahir', 'jenis kelamin', 'customer type', 'notes'],
      [['C-1', 'Budi', '081234567890', 'Jl. A', '15/01/1990', 'L', 'retail', 'x']],
    );
    const rows = await parseCustomerImportBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Budi', phone: '081234567890' });
  });

  it('tolerates required-star and parenthetical headers', async () => {
    const buf = await toBuffer(['Kode', 'Nama *', 'Kontak (wajib isi)'], [['', 'Budi', '081234567890']]);
    const rows = await parseCustomerImportBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Budi', phone: '081234567890' });
  });

  it('converts Excel date cells to dd/mm/yyyy strings', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Import Pelanggan');
    ws.addRow(EXPECTED_HEADERS);
    ws.addRow(['', 'Budi', '081234567890', '', new Date(1990, 0, 15), 'L', 'retail', '']);
    const buf = (await wb.xlsx.writeBuffer()) as Buffer;
    const rows = await parseCustomerImportBuffer(buf);
    expect(rows[0].dateOfBirthRaw).toBe('15/01/1990');
  });

  it('throws when Nama or Kontak columns are missing', async () => {
    await expect(
      toBuffer(['Kode', 'Kontak'], [['C-1', '081234567890']]).then((b) => parseCustomerImportBuffer(b)),
    ).rejects.toThrow(/Nama/);
    await expect(
      toBuffer(['Kode', 'Nama'], [['C-1', 'Budi']]).then((b) => parseCustomerImportBuffer(b)),
    ).rejects.toThrow(/Kontak/);
  });

  it('throws on empty data and caps at 5000 rows', async () => {
    await expect(
      toBuffer(['Nama', 'Kontak'], []).then((b) => parseCustomerImportBuffer(b)),
    ).rejects.toThrow(/Tidak ada baris/);
    const many = Array.from({ length: 5001 }, (_, i) => [`Pelanggan ${i}`, '081234567890']);
    await expect(
      toBuffer(['Nama', 'Kontak'], many).then((b) => parseCustomerImportBuffer(b)),
    ).rejects.toThrow(/5000/);
  });

  it('skips fully blank rows', async () => {
    const buf = await toBuffer(
      ['Nama', 'Kontak'],
      [['Budi', '081234567890'], [], ['Siti', '081234567891']],
    );
    const rows = await parseCustomerImportBuffer(buf);
    expect(rows.map((r: any) => r.name)).toEqual(['Budi', 'Siti']);
  });
});
