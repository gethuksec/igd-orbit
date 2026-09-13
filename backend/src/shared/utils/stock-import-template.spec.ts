/**
 * IGDERP-97 (I4) — template/parse unit specs (pure, no DB).
 */
const ExcelJS = require('exceljs');
const {
  buildImportTemplate,
  buildSnapshotWorkbook,
  parseImportBuffer,
  parseImportNumber,
} = require('./stock-import-template');

async function toBuffer(headers: string[], rows: any[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  return (await wb.xlsx.writeBuffer()) as Buffer;
}

describe('parseImportNumber', () => {
  it.each([
    [10, 10],
    ['10', 10],
    ['10,5', 10.5],
    ['1.000,5', 1000.5],
    [' 7 ', 7],
  ])('parses %p as %p', (input, expected) => {
    expect(parseImportNumber(input)).toBe(expected);
  });

  it.each([['abc'], [''], [null], [undefined], [NaN]])('rejects %p', (input) => {
    expect(parseImportNumber(input)).toBeNull();
  });
});

describe('template round-trip', () => {
  it('template has Data (headers) + Contoh (5 sample rows) sheets', async () => {
    const buf = await buildImportTemplate();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    expect(wb.worksheets.map((w: any) => w.name)).toEqual(['Data', 'Contoh']);
    expect(wb.getWorksheet('Contoh')!.rowCount).toBe(6); // header + 5
  });

  it('export snapshot parses back through the import parser', async () => {
    const buf = await buildSnapshotWorkbook([
      { sku: 'A-1', barcode: 'B-1', name: 'Produk A', quantity: 10, stockValue: 15000 },
      { sku: 'A-2', name: 'Produk B', quantity: 3 },
    ]);
    const rows = await parseImportBuffer(buf);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ sku: 'A-1', barcode: 'B-1', quantityRaw: '10' });
    expect(rows[1].stockValueRaw).toBe('');
  });

  it('matches Indonesian header aliases (client-template ready)', async () => {
    const buf = await toBuffer(
      ['Kode Produk', 'Jumlah', 'Harga'],
      [['X-1', 4, 9000]],
    );
    const rows = await parseImportBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sku: 'X-1', quantityRaw: '4', stockValueRaw: '9000' });
  });

  it('tolerates required-star and parenthetical headers', async () => {
    const buf = await toBuffer(['SKU *', 'Qty (wajib isi)'], [['X-1', 4]]);
    const rows = await parseImportBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sku: 'X-1', quantityRaw: '4' });
  });

  it('template Data headers are byte-identical to the export snapshot', async () => {
    const tpl = await buildImportTemplate();
    const exp = await buildSnapshotWorkbook([
      { sku: 'A-1', name: 'Produk A', quantity: 1 },
    ]);
    const headers = async (buf: Buffer) => {
      const w = new ExcelJS.Workbook();
      await w.xlsx.load(buf as any);
      return (w.getWorksheet('Data')!.getRow(1).values as any[]).slice(1).join('|');
    };
    expect(await headers(tpl)).toBe(await headers(exp));
  });

  it('throws when identifier and quantity columns are missing', async () => {
    await expect(toBuffer(['Nama Produk'], [['X']]).then((b) => parseImportBuffer(b))).rejects.toThrow(
      /SKU atau Barcode/,
    );
    await expect(toBuffer(['SKU'], [['X']]).then((b) => parseImportBuffer(b))).rejects.toThrow(
      /Qty/,
    );
  });

  it('throws on empty data and caps at 5000 rows', async () => {
    await expect(toBuffer(['SKU', 'Qty'], []).then((b) => parseImportBuffer(b))).rejects.toThrow(
      /Tidak ada baris/,
    );
    const many = Array.from({ length: 5001 }, (_, i) => [`S-${i}`, 1]);
    await expect(toBuffer(['SKU', 'Qty'], many).then((b) => parseImportBuffer(b))).rejects.toThrow(
      /5000/,
    );
  });

  it('skips fully blank rows', async () => {
    const buf = await toBuffer(['SKU', 'Qty'], [['A-1', 2], [], ['A-2', 1]]);
    const rows = await parseImportBuffer(buf);
    expect(rows.map((r) => r.sku)).toEqual(['A-1', 'A-2']);
  });
});
