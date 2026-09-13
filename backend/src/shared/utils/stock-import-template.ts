/**
 * IGDERP-97 (I4) — shared Stock In / Stock Out Excel contract.
 *
 * ONE template for import AND export (round-trip): what export produces,
 * import accepts — same columns, same order. Warehouse/outlet travel in the
 * request (one doc = one warehouse, like the manual form), not per row.
 *
 * Column-mapping layer: headers are matched case-insensitively against
 * alias lists, so a future client template only needs new aliases here —
 * no parser rewrite.
 */
const ExcelJS = require('exceljs');

export interface ImportColumnDef {
  key: 'sku' | 'barcode' | 'name' | 'quantity' | 'stockValue' | 'notes';
  label: string;
  aliases: string[];
  required: boolean;
}

export const IMPORT_COLUMNS: ImportColumnDef[] = [
  {
    key: 'sku',
    label: 'SKU',
    aliases: ['sku', 'kode', 'kodeproduk', 'kode_produk', 'productcode', 'code'],
    required: false, // identifier = sku OR barcode (at least one required)
  },
  {
    key: 'barcode',
    label: 'Barcode',
    aliases: ['barcode', 'barkod', 'ean', 'upc'],
    required: false,
  },
  {
    key: 'name',
    label: 'Nama Produk',
    aliases: ['namaproduk', 'nama_produk', 'name', 'product', 'productname', 'namabarang'],
    required: false, // display/export only; resolution is by sku/barcode
  },
  {
    key: 'quantity',
    label: 'Qty',
    aliases: ['qty', 'quantity', 'jumlah', 'jumlahproduk', 'stok', 'stock'],
    required: true,
  },
  {
    key: 'stockValue',
    label: 'Nilai Stok',
    aliases: ['nilaistok', 'nilai_stok', 'nilai', 'stockvalue', 'harga', 'price', 'hargabeli'],
    required: false, // defaults server-side to Product.minSellingPrice
  },
  {
    key: 'notes',
    label: 'Keterangan',
    aliases: ['keterangan', 'notes', 'note', 'catatan', 'description'],
    required: false,
  },
];

const norm = (v: any) =>
  String(v ?? '')
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '');

export interface RawImportRow {
  rowNumber: number;
  sku?: string;
  barcode?: string;
  name?: string;
  quantityRaw: any;
  stockValueRaw: any;
  notes?: string;
}

/** Parse an uploaded workbook buffer into raw rows (no DB, no writes). */
export async function parseImportBuffer(buffer: Buffer): Promise<RawImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel kosong (tidak ada sheet)');

  const headerRow = ws.getRow(1);
  const colToKey = new Map<number, ImportColumnDef['key']>();
  headerRow.eachCell((cell: any, col: number) => {
    const h = norm(cell.value);
    if (!h) return;
    const def = IMPORT_COLUMNS.find((c) => c.aliases.includes(h));
    if (def && ![...colToKey.values()].includes(def.key)) colToKey.set(col, def.key);
  });

  const keys = new Set(colToKey.values());
  const hasId = keys.has('sku') || keys.has('barcode');
  if (!hasId) throw new Error('Kolom SKU atau Barcode tidak ditemukan di file');
  if (!keys.has('quantity')) throw new Error('Kolom Qty tidak ditemukan di file');

  const rows: RawImportRow[] = [];
  ws.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) return;
    const get = (key: ImportColumnDef['key']) => {
      for (const [col, k] of colToKey) {
        if (k === key) {
          const v = row.getCell(col).value;
          return v === null || v === undefined ? '' : String(v).trim();
        }
      }
      return '';
    };
    const sku = get('sku');
    const barcode = get('barcode');
    const qty = get('quantity');
    if (!sku && !barcode && !qty && !get('name')) return; // trailing blank
    rows.push({
      rowNumber,
      sku: sku || undefined,
      barcode: barcode || undefined,
      name: get('name') || undefined,
      quantityRaw: qty,
      stockValueRaw: get('stockValue'),
      notes: get('notes') || undefined,
    });
  });
  if (rows.length === 0) throw new Error('Tidak ada baris data di file');
  if (rows.length > 5000) throw new Error('Maksimal 5000 baris per import');
  return rows;
}

/** Indonesian/US-tolerant number parse: 10 | "10" | "10,5" | "1.000,5". */
export function parseImportNumber(v: any): number | null {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const direct = Number(s);
  if (Number.isFinite(direct)) return direct;
  const idFmt = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(idFmt) ? idFmt : null;
}

export interface SnapshotRow {
  sku: string;
  barcode?: string | null;
  name: string;
  quantity: number;
  stockValue?: number | null;
  notes?: string | null;
}

function styleHeader(row: any) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F6F43' } };
  row.alignment = { vertical: 'middle' };
}

const SAMPLE_ROWS: SnapshotRow[] = [
  { sku: 'CONTOH-001', barcode: '899000000001', name: 'Contoh Produk 1', quantity: 10, stockValue: 15000, notes: 'Hapus baris contoh sebelum upload' },
  { sku: 'CONTOH-002', barcode: '899000000002', name: 'Contoh Produk 2', quantity: 5, stockValue: 25000 },
  { sku: 'CONTOH-003', name: 'Contoh Produk 3 (tanpa barcode)', quantity: 12 },
  { sku: 'CONTOH-004', barcode: '899000000004', name: 'Contoh Produk 4', quantity: 3, stockValue: 99000, notes: 'Nilai opsional' },
  { sku: 'CONTOH-005', name: 'Contoh Produk 5', quantity: 20 },
];

/** Template workbook: 'Data' sheet (headers only) + 'Contoh' sheet (5 sample rows). */
export async function buildImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const headers = IMPORT_COLUMNS.map((c) => c.label + (c.required ? ' *' : ''));
  const data = wb.addWorksheet('Data');
  data.addRow(headers);
  styleHeader(data.getRow(1));
  data.columns = IMPORT_COLUMNS.map(() => ({ width: 20 }));
  const sample = wb.addWorksheet('Contoh');
  sample.addRow(headers);
  styleHeader(sample.getRow(1));
  for (const r of SAMPLE_ROWS) {
    sample.addRow([r.sku, r.barcode ?? '', r.name, r.quantity, r.stockValue ?? '', r.notes ?? '']);
  }
  sample.columns = IMPORT_COLUMNS.map(() => ({ width: 24 }));
  return (await wb.xlsx.writeBuffer()) as Buffer;
}

/** Snapshot workbook for export — identical columns (round-trip). */
export async function buildSnapshotWorkbook(rows: SnapshotRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');
  ws.addRow(IMPORT_COLUMNS.map((c) => c.label));
  styleHeader(ws.getRow(1));
  for (const r of rows) {
    ws.addRow([r.sku, r.barcode ?? '', r.name, r.quantity, r.stockValue ?? '', r.notes ?? '']);
  }
  ws.columns = IMPORT_COLUMNS.map(() => ({ width: 20 }));
  return (await wb.xlsx.writeBuffer()) as Buffer;
}
