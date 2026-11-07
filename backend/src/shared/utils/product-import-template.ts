/**
 * Product XLSX import template contract (user template, 29 columns).
 *
 * ONE template for the product master import: header-only `Data` sheet for
 * upload + `Contoh` sheet with a single example row. Headers are matched
 * case-insensitively against alias lists (lowercase, strip parentheticals,
 * spaces/underscores/stars), so minor client header variations still parse.
 */
const ExcelJS = require('exceljs');

export interface ProductImportColumnDef {
  key: string;
  label: string;
  aliases: string[];
  required: boolean;
}

export const PRODUCT_IMPORT_HEADERS: string[] = [
  'Barcode',
  'Item',
  'Nama Tercetak',
  'Satuan',
  'Kategori',
  'Grade',
  'Merek',
  'Ukuran',
  'Warna',
  'Harga Reguler',
  'Harga Member T1',
  'Jasa(Y/N)',
  'SN(1)/Bahan(2)',
  'Harga Modal',
  'Supplier',
  'Platinum',
  'Gold',
  'Silver',
  'User',
  'Stok IGD Kalisat - Spare Part',
  'Stok IGD Kalisat - Service',
  'Stok IGD Jember - Spare Part',
  'Stok IGD Jember - Service',
  'Stok iSaid Jember - Spare Part',
  'Stok iSaid Jember - Service',
  'Stok Warehouse - IGD MWH - Bad Stock',
  'Stok Warehouse - IGD MWH - Buffer',
  'Stok Marketplace - Good Stock',
  'Stok Marketplace - Bad Stock',
];

/** Fixed per-warehouse opening-stock columns (subset of the 29 headers). */
export const PRODUCT_STOCK_LABELS: string[] = PRODUCT_IMPORT_HEADERS.slice(19);

export const PRODUCT_IMPORT_COLUMNS: ProductImportColumnDef[] = [
  { key: 'barcode', label: 'Barcode', aliases: ['barcode', 'barkod', 'ean', 'upc'], required: false },
  { key: 'name', label: 'Item', aliases: ['item', 'namaproduk', 'nama_produk', 'name', 'product', 'productname', 'namabarang', 'namaitem'], required: true },
  { key: 'printedName', label: 'Nama Tercetak', aliases: ['namatercetak', 'printedname', 'namacetak'], required: false },
  { key: 'unit', label: 'Satuan', aliases: ['satuan', 'unit'], required: false },
  { key: 'category', label: 'Kategori', aliases: ['kategori', 'category'], required: false },
  { key: 'grade', label: 'Grade', aliases: ['grade'], required: false },
  { key: 'brand', label: 'Merek', aliases: ['merek', 'brand', 'merk'], required: false },
  { key: 'size', label: 'Ukuran', aliases: ['ukuran', 'size'], required: false },
  { key: 'color', label: 'Warna', aliases: ['warna', 'color', 'colour'], required: false },
  { key: 'sellingPrice', label: 'Harga Reguler', aliases: ['hargareguler', 'hargajual', 'sellingprice'], required: true },
  { key: 'memberT1', label: 'Harga Member T1', aliases: ['hargamembert1', 'membert1'], required: false },
  { key: 'isService', label: 'Jasa(Y/N)', aliases: ['jasa', 'jasayn', 'isservice'], required: false },
  { key: 'trackSerial', label: 'SN(1)/Bahan(2)', aliases: ['sn', 'sn/bahan', 'snbahan', 'trackserial'], required: false },
  { key: 'costPrice', label: 'Harga Modal', aliases: ['hargamodal', 'costprice', 'hargabeli'], required: true },
  { key: 'supplier', label: 'Supplier', aliases: ['supplier', 'pemasok'], required: false },
  { key: 'platinum', label: 'Platinum', aliases: ['platinum'], required: false },
  { key: 'gold', label: 'Gold', aliases: ['gold'], required: false },
  { key: 'silver', label: 'Silver', aliases: ['silver'], required: false },
  { key: 'user', label: 'User', aliases: ['user'], required: false },
];

const norm = (v: any) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // strip parentheticals: "Jasa(Y/N)" -> "Jasa"
    .replace(/[_\s*]+/g, ''); // strip separators + required stars

const normLabel = (label: string) => norm(label);

export interface RawProductImportRow {
  rowNumber: number;
  barcode?: string;
  name?: string;
  printedName?: string;
  unit?: string;
  category?: string;
  grade?: string;
  brand?: string;
  size?: string;
  color?: string;
  sellingPriceRaw: any;
  memberT1Raw: any;
  isServiceRaw: any;
  trackSerialRaw: any;
  costPriceRaw: any;
  supplier?: string;
  platinumRaw: any;
  goldRaw: any;
  silverRaw: any;
  userRaw: any;
  /** Raw cell per stock column, keyed by the exact template label. */
  stocksRaw: Record<string, any>;
}

/** Parse an uploaded workbook buffer into raw rows (no DB, no writes). */
export async function parseProductImportBuffer(buffer: Buffer): Promise<RawProductImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel kosong (tidak ada sheet)');

  const stockNorm = new Map(PRODUCT_STOCK_LABELS.map((l) => [normLabel(l), l]));
  const colToKey = new Map<number, string>();
  const colToStock = new Map<number, string>();
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell: any, col: number) => {
    const h = norm(cell.value);
    if (!h) return;
    const def = PRODUCT_IMPORT_COLUMNS.find((c) => c.aliases.includes(h));
    if (def && ![...colToKey.values()].includes(def.key)) {
      colToKey.set(col, def.key);
      return;
    }
    const stockLabel = stockNorm.get(h);
    if (stockLabel && ![...colToStock.values()].includes(stockLabel)) colToStock.set(col, stockLabel);
  });

  if (![...colToKey.values()].includes('name')) {
    throw new Error('Kolom Item tidak ditemukan di file');
  }

  const rows: RawProductImportRow[] = [];
  ws.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) return;
    const get = (key: string) => {
      for (const [col, k] of colToKey) {
        if (k === key) {
          const v = row.getCell(col).value;
          return v === null || v === undefined ? '' : String(v).trim();
        }
      }
      return '';
    };
    const name = get('name');
    const barcode = get('barcode');
    if (!name && !barcode) {
      // skip fully blank rows (all mapped cells empty)
      let any = false;
      row.eachCell((c: any) => {
        if (c.value !== null && c.value !== undefined && String(c.value).trim() !== '') any = true;
      });
      if (!any) return;
    }
    const stocksRaw: Record<string, any> = {};
    for (const [col, label] of colToStock) {
      const v = row.getCell(col).value;
      stocksRaw[label] = v === null || v === undefined ? '' : (typeof v === 'string' ? v.trim() : v);
    }
    rows.push({
      rowNumber,
      barcode: barcode || undefined,
      name: name || undefined,
      printedName: get('printedName') || undefined,
      unit: get('unit') || undefined,
      category: get('category') || undefined,
      grade: get('grade') || undefined,
      brand: get('brand') || undefined,
      size: get('size') || undefined,
      color: get('color') || undefined,
      sellingPriceRaw: get('sellingPrice'),
      memberT1Raw: get('memberT1'),
      isServiceRaw: get('isService'),
      trackSerialRaw: get('trackSerial'),
      costPriceRaw: get('costPrice'),
      supplier: get('supplier') || undefined,
      platinumRaw: get('platinum'),
      goldRaw: get('gold'),
      silverRaw: get('silver'),
      userRaw: get('user'),
      stocksRaw,
    });
  });
  if (rows.length === 0) throw new Error('Tidak ada baris data di file');
  if (rows.length > 5000) throw new Error('Maksimal 5000 baris per import');
  return rows;
}

/** Indonesian/US-tolerant number parse: 10 | "10" | "10,5" | "1.000,5". */
export function parseProductImportNumber(v: any): number | null {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const direct = Number(s);
  if (Number.isFinite(direct)) return direct;
  const idFmt = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(idFmt) ? idFmt : null;
}

function styleHeader(row: any) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F6F43' } };
  row.alignment = { vertical: 'middle' };
}

const EXAMPLE_ROW: any[] = [
  '899000000001',
  'Contoh Produk',
  'Contoh Produk',
  'Pcs',
  'Spare Part',
  'Original',
  'Contoh Merek',
  '-',
  'Hitam',
  150000,
  '',
  'N',
  '2',
  100000,
  '',
  5,
  3,
  2,
  0,
  10,
  0,
  5,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
];

/** Template workbook: `Data` sheet (headers only) + `Contoh` sheet (1 example row). */
export async function buildProductImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const data = wb.addWorksheet('Data');
  data.addRow(PRODUCT_IMPORT_HEADERS);
  styleHeader(data.getRow(1));
  data.columns = PRODUCT_IMPORT_HEADERS.map(() => ({ width: 22 }));
  const sample = wb.addWorksheet('Contoh');
  sample.addRow(PRODUCT_IMPORT_HEADERS);
  styleHeader(sample.getRow(1));
  sample.addRow(EXAMPLE_ROW);
  sample.columns = PRODUCT_IMPORT_HEADERS.map(() => ({ width: 24 }));
  return (await wb.xlsx.writeBuffer()) as Buffer;
}
