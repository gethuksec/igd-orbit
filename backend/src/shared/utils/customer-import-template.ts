/**
 * Customer XLSX import — template + parser.
 *
 * Template (user template, EXACT):
 * 8 columns, headers byte-identical, header-only main sheet 'Import Pelanggan':
 *   ["Kode","Nama","Kontak","Alamat","Tanggal Lahir(dd/mm/yyyy)",
 *    "Jenis Kelamin(L/P)","Type Customer","Keterangan"]
 * plus a 'Contoh' sheet with sample rows.
 *
 * Column-mapping layer: headers are matched case-insensitively against
 * alias lists (parentheticals and separators stripped), so a future
 * client template only needs new aliases here — no parser rewrite.
 */
const ExcelJS = require('exceljs');

export interface CustomerImportColumnDef {
  key:
    | 'customerCode'
    | 'name'
    | 'phone'
    | 'address'
    | 'dateOfBirth'
    | 'gender'
    | 'customerType'
    | 'notes';
  label: string;
  aliases: string[];
  required: boolean;
}

export const IMPORT_COLUMNS: CustomerImportColumnDef[] = [
  {
    key: 'customerCode',
    label: 'Kode',
    aliases: ['kode', 'code', 'customercode', 'kodecustomer', 'kodepelanggan'],
    required: false,
  },
  {
    key: 'name',
    label: 'Nama',
    aliases: ['nama', 'name', 'namapelanggan', 'namacustomer', 'customername'],
    required: true,
  },
  {
    key: 'phone',
    label: 'Kontak',
    aliases: [
      'kontak',
      'phone',
      'telepon',
      'telp',
      'nohp',
      'handphone',
      'nomortelepon',
      'nomorhp',
      'nomorkontak',
    ],
    required: true,
  },
  {
    key: 'address',
    label: 'Alamat',
    aliases: ['alamat', 'address'],
    required: false,
  },
  {
    key: 'dateOfBirth',
    label: 'Tanggal Lahir(dd/mm/yyyy)',
    aliases: ['tanggallahir', 'dateofbirth', 'dob', 'tanggallahirddmmyyyy'],
    required: false,
  },
  {
    key: 'gender',
    label: 'Jenis Kelamin(L/P)',
    aliases: ['jeniskelamin', 'gender', 'jk', 'jeniskelaminlp'],
    required: false,
  },
  {
    key: 'customerType',
    label: 'Type Customer',
    aliases: [
      'typecustomer',
      'customertype',
      'tipecustomer',
      'jenispelanggan',
      'tipepelanggan',
      'type',
    ],
    required: false,
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
    .replace(/\(.*?\)/g, '') // strip parentheticals: "Tanggal Lahir(dd/mm/yyyy)" -> "Tanggal Lahir"
    .replace(/[_\s*/.-]+/g, ''); // strip separators + required stars: "Nama *" -> "nama"

export interface RawCustomerImportRow {
  rowNumber: number;
  customerCode?: string;
  name?: string;
  phone?: string;
  address?: string;
  dateOfBirthRaw?: string;
  genderRaw?: string;
  customerTypeRaw?: string;
  notes?: string;
}

/** ExcelJS cell -> trimmed string. Date cells become dd/mm/yyyy. */
function cellToString(value: any): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const dd = String(value.getDate()).padStart(2, '0');
    const mm = String(value.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${value.getFullYear()}`;
  }
  if (typeof value === 'object') {
    if (Array.isArray((value as any).richText)) {
      return (value as any).richText.map((r: any) => r.text ?? '').join('').trim();
    }
    if ((value as any).result !== undefined) return cellToString((value as any).result);
    if ((value as any).text !== undefined) return String((value as any).text).trim();
    return '';
  }
  return String(value).trim();
}

/** Parse an uploaded workbook buffer into raw rows (no DB, no writes). */
export async function parseCustomerImportBuffer(buffer: Buffer): Promise<RawCustomerImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel kosong (tidak ada sheet)');

  const headerRow = ws.getRow(1);
  const colToKey = new Map<number, CustomerImportColumnDef['key']>();
  headerRow.eachCell((cell: any, col: number) => {
    const h = norm(cellToString(cell.value));
    if (!h) return;
    const def = IMPORT_COLUMNS.find((c) => c.aliases.includes(h));
    if (def && ![...colToKey.values()].includes(def.key)) colToKey.set(col, def.key);
  });

  const keys = new Set(colToKey.values());
  if (!keys.has('name')) throw new Error('Kolom Nama tidak ditemukan di file');
  if (!keys.has('phone')) throw new Error('Kolom Kontak tidak ditemukan di file');

  const rows: RawCustomerImportRow[] = [];
  ws.eachRow((row: any, rowNumber: number) => {
    if (rowNumber === 1) return;
    const get = (key: CustomerImportColumnDef['key']) => {
      for (const [col, k] of colToKey) {
        if (k === key) return cellToString(row.getCell(col).value);
      }
      return '';
    };
    const customerCode = get('customerCode');
    const name = get('name');
    const phone = get('phone');
    const address = get('address');
    const dateOfBirthRaw = get('dateOfBirth');
    const genderRaw = get('gender');
    const customerTypeRaw = get('customerType');
    const notes = get('notes');
    if (
      !customerCode &&
      !name &&
      !phone &&
      !address &&
      !dateOfBirthRaw &&
      !genderRaw &&
      !customerTypeRaw &&
      !notes
    )
      return; // trailing blank
    rows.push({
      rowNumber,
      customerCode: customerCode || undefined,
      name: name || undefined,
      phone: phone || undefined,
      address: address || undefined,
      dateOfBirthRaw: dateOfBirthRaw || undefined,
      genderRaw: genderRaw || undefined,
      customerTypeRaw: customerTypeRaw || undefined,
      notes: notes || undefined,
    });
  });
  if (rows.length === 0) throw new Error('Tidak ada baris data di file');
  if (rows.length > 5000) throw new Error('Maksimal 5000 baris per import');
  return rows;
}

function styleHeader(row: any) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F6F43' } };
  row.alignment = { vertical: 'middle' };
}

const SAMPLE_ROWS: string[][] = [
  ['CUST-001', 'Budi Santoso', '081234567890', 'Jl. Merdeka No. 1', '15/01/1990', 'L', 'retail', 'Pelanggan setia'],
  ['', 'Siti Aminah', '081234567891', 'Jl. Sudirman No. 2', '20/05/1985', 'P', 'wholesale', ''],
  ['', 'PT Maju Jaya', '021987654321', 'Jl. Gatot Subroto No. 10', '', '', 'corporate', 'Hapus baris contoh sebelum upload'],
];

/** Template workbook: 'Import Pelanggan' sheet (headers only) + 'Contoh' sheet (sample rows). */
export async function buildCustomerImportTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const headers = IMPORT_COLUMNS.map((c) => c.label);
  const data = wb.addWorksheet('Import Pelanggan');
  data.addRow(headers);
  styleHeader(data.getRow(1));
  data.columns = IMPORT_COLUMNS.map(() => ({ width: 24 }));
  const sample = wb.addWorksheet('Contoh');
  sample.addRow(headers);
  styleHeader(sample.getRow(1));
  for (const r of SAMPLE_ROWS) sample.addRow(r);
  sample.columns = IMPORT_COLUMNS.map(() => ({ width: 24 }));
  return (await wb.xlsx.writeBuffer()) as Buffer;
}

/** Export header order (byte-identical to the template labels). */
export const CUSTOMER_EXPORT_HEADERS: string[] = IMPORT_COLUMNS.map((c) => c.label);

/**
 * Export workbook: 'Import Pelanggan' sheet with template-identical headers
 * plus one row per customer. Accepts rows either as position arrays (already
 * in template order) or as records keyed by exact header label.
 */
export async function buildCustomerExportWorkbook(
  rows: Array<Record<string, any> | any[]>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const headers = IMPORT_COLUMNS.map((c) => c.label);
  const data = wb.addWorksheet('Import Pelanggan');
  data.addRow(headers);
  styleHeader(data.getRow(1));
  for (const r of rows) {
    data.addRow(Array.isArray(r) ? r : headers.map((h) => r[h] ?? ''));
  }
  data.columns = IMPORT_COLUMNS.map(() => ({ width: 24 }));
  return (await wb.xlsx.writeBuffer()) as Buffer;
}
