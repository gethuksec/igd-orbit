/**
 * Product XLSX template/parse unit specs (pure, no DB).
 */
const ExcelJS = require('exceljs');
const {
  buildProductImportTemplate,
  parseProductImportBuffer,
  parseProductImportNumber,
  PRODUCT_IMPORT_HEADERS,
  PRODUCT_STOCK_LABELS,
} = require('./product-import-template');

async function toBuffer(headers: string[], rows: any[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  return (await wb.xlsx.writeBuffer()) as Buffer;
}

describe('parseProductImportNumber', () => {
  it.each([
    [10, 10],
    ['10', 10],
    ['10,5', 10.5],
    ['1.000,5', 1000.5],
    [' 7 ', 7],
  ])('parses %p as %p', (input, expected) => {
    expect(parseProductImportNumber(input)).toBe(expected);
  });

  it.each([['abc'], [''], [null], [undefined], [NaN]])('rejects %p', (input) => {
    expect(parseProductImportNumber(input)).toBeNull();
  });
});

describe('product template contract', () => {
  it('has exactly 29 headers byte-identical to the user template order', async () => {
    expect(PRODUCT_IMPORT_HEADERS).toHaveLength(29);
    expect(PRODUCT_IMPORT_HEADERS.slice(0, 3)).toEqual(['Barcode', 'Item', 'Nama Tercetak']);
    expect(PRODUCT_STOCK_LABELS).toHaveLength(10);
    const buf = await buildProductImportTemplate();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    const headers = (wb.getWorksheet('Data')!.getRow(1).values as any[]).slice(1);
    expect(headers).toEqual(PRODUCT_IMPORT_HEADERS);
  });

  it('template has Data (headers only) + Contoh (1 example row) sheets', async () => {
    const buf = await buildProductImportTemplate();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as any);
    expect(wb.worksheets.map((w: any) => w.name)).toEqual(['Data', 'Contoh']);
    expect(wb.getWorksheet('Data')!.rowCount).toBe(1);
    expect(wb.getWorksheet('Contoh')!.rowCount).toBe(2);
  });

  it('parses a full-template row including per-warehouse stocks', async () => {
    const row = Array(PRODUCT_IMPORT_HEADERS.length).fill('');
    row[0] = 'B-001';
    row[1] = 'Produk A';
    row[9] = 150000;
    row[13] = 100000;
    row[19] = 10;
    const buf = await toBuffer(PRODUCT_IMPORT_HEADERS, [row]);
    const rows = await parseProductImportBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ barcode: 'B-001', name: 'Produk A' });
    expect(rows[0].stocksRaw[PRODUCT_IMPORT_HEADERS[19]]).toBe(10);
  });

  it('matches aliases (kode produk / jumlah style tolerance)', async () => {
    const buf = await toBuffer(
      ['Barcode *', 'ITEM', 'Harga Reguler (wajib)', 'harga_modal', 'JASA(Y/N)', 'SN(1)/Bahan(2)'],
      [['B-1', 'Produk X', 5000, 3000, 'Y', '1']],
    );
    const rows = await parseProductImportBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      barcode: 'B-1',
      name: 'Produk X',
      sellingPriceRaw: '5000',
      isServiceRaw: 'Y',
      trackSerialRaw: '1',
    });
  });

  it('throws when the Item column is missing', async () => {
    await expect(toBuffer(['Barcode'], [['B-1']]).then((b) => parseProductImportBuffer(b))).rejects.toThrow(
      /Item/,
    );
  });

  it('throws on empty data and caps at 5000 rows', async () => {
    await expect(toBuffer(PRODUCT_IMPORT_HEADERS, []).then((b) => parseProductImportBuffer(b))).rejects.toThrow(
      /Tidak ada baris/,
    );
    const many = Array.from({ length: 5001 }, (_, i) => ['', `Produk ${i}`]);
    await expect(
      toBuffer(['Barcode', 'Item'], many).then((b) => parseProductImportBuffer(b)),
    ).rejects.toThrow(/5000/);
  });

  it('skips fully blank rows', async () => {
    const buf = await toBuffer(['Barcode', 'Item'], [['B-1', 'A'], [], ['B-2', 'B']]);
    const rows = await parseProductImportBuffer(buf);
    expect(rows.map((r: any) => r.barcode)).toEqual(['B-1', 'B-2']);
  });
});
