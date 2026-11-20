/**
 * IGDERP-271 — contract bulk import from the payroll workbook layout.
 *
 * Source of truth for the FILE SHAPE is the HR payroll sheet
 * (Format_HR_ORBIT.xlsx → `Payroll`): real headers live in row 2 (row 1
 * carries merged group labels), data starts at row 3. No new template —
 * the parser alias-matches headers, so minor renames don't break it.
 *
 * Pure parse only (no DB, no writes): returns raw rows; the import service
 * resolves masters (NIP → employee, LEVEL → position+grade, SECTOR →
 * division, AREA → penempatan branches) and reports misses as
 * incomplete flags — imports always land as drafts.
 */
const ExcelJS = require('exceljs');

export interface ContractImportColumnDef {
  key:
    | 'name'
    | 'nip'
    | 'level'
    | 'contractType'
    | 'contractTime'
    | 'sector'
    | 'hireDate'
    | 'area'
    | 'basicSalary';
  label: string;
  aliases: string[];
  required: boolean;
}

export const CONTRACT_IMPORT_COLUMNS: ContractImportColumnDef[] = [
  {
    key: 'name',
    label: 'NAMA',
    aliases: ['nama', 'name', 'namakaryawan', 'nama_karyawan', 'fullname', 'nama_lengkap'],
    required: true,
  },
  {
    key: 'nip',
    label: 'NIP',
    aliases: ['nip', 'employeecode', 'employee_code', 'kodekaryawan', 'kode_karyawan', 'nik', 'nomorinduk'],
    required: true,
  },
  {
    key: 'level',
    label: 'LEVEL',
    aliases: ['level', 'posisi', 'jabatan', 'position', 'title'],
    required: false,
  },
  {
    key: 'contractType',
    label: 'JENIS KONTRAK',
    aliases: ['jeniskontrak', 'jenis_kontrak', 'contracttype', 'tipekontrak', 'tipe_kontrak', 'jeniskontrakkerja'],
    required: false,
  },
  {
    key: 'contractTime',
    label: 'WAKTU KONTRAK',
    aliases: ['waktukontrak', 'waktu_kontrak', 'kontrakberakhir', 'berakhir', 'enddate', 'contractend', 'masakontrak'],
    required: false,
  },
  {
    key: 'sector',
    label: 'SECTOR',
    aliases: ['sector', 'sektor', 'divisi', 'division', 'bidang'],
    required: false,
  },
  {
    key: 'hireDate',
    label: 'TANGGAL MASUK',
    aliases: ['tanggalmasuk', 'tanggal_masuk', 'hiredate', 'tglmasuk', 'tgl_masuk', 'startdate', 'tanggalmulai'],
    required: false,
  },
  {
    key: 'area',
    label: 'AREA',
    aliases: ['area', 'penempatan', 'outlet', 'branch', 'cabang', 'lokasi'],
    required: false,
  },
  {
    key: 'basicSalary',
    label: 'GAJI POKOK',
    aliases: ['gajipokok', 'gaji_pokok', 'basicsalary', 'gaji', 'salary', 'pokok'],
    required: false,
  },
];

const norm = (v: any) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // strip parentheticals
    .replace(/[_\s*]+/g, ''); // strip separators + required stars

export interface RawContractImportRow {
  rowNumber: number;
  name?: string;
  nip?: string;
  level?: string;
  contractTypeRaw: any;
  contractTimeRaw: any;
  sector?: string;
  hireDateRaw: any;
  area?: string;
  basicSalaryRaw: any;
}

/** Parse an uploaded payroll workbook buffer into raw rows (no DB, no writes). */
export async function parseContractImportBuffer(buffer: Buffer): Promise<RawContractImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws =
    wb.worksheets.find((s: any) => norm(s.name) === 'payroll') ?? wb.worksheets[0];
  if (!ws) throw new Error('File Excel kosong (tidak ada sheet)');

  // Real headers sit below merged group labels — scan the first 5 rows for
  // the one carrying known contract headers (NAMA + NIP at minimum).
  let headerRowNum = -1;
  let colToKey = new Map<number, ContractImportColumnDef['key']>();
  for (let r = 1; r <= Math.min(5, ws.rowCount); r++) {
    const candidate = new Map<number, ContractImportColumnDef['key']>();
    ws.getRow(r).eachCell((cell: any, col: number) => {
      const h = norm(cell.value);
      if (!h) return;
      const def = CONTRACT_IMPORT_COLUMNS.find((c) => c.aliases.includes(h));
      if (def && ![...candidate.values()].includes(def.key)) candidate.set(col, def.key);
    });
    const keys = new Set(candidate.values());
    if (keys.has('name') && keys.has('nip')) {
      headerRowNum = r;
      colToKey = candidate;
      break;
    }
  }
  if (headerRowNum === -1) {
    throw new Error('Kolom NAMA / NIP tidak ditemukan di file (header di baris 1-5)');
  }

  const str = (row: any, key: ContractImportColumnDef['key']): string => {
    for (const [col, k] of colToKey) {
      if (k === key) {
        const v = row.getCell(col).value;
        if (v === null || v === undefined) return '';
        if (v instanceof Date) return v.toISOString();
        if (typeof v === 'object' && 'text' in (v as any)) return String((v as any).text).trim();
        return String(v).trim();
      }
    }
    return '';
  };
  const rawCell = (row: any, key: ContractImportColumnDef['key']): any => {
    for (const [col, k] of colToKey) {
      if (k === key) return row.getCell(col).value ?? '';
    }
    return '';
  };

  const rows: RawContractImportRow[] = [];
  ws.eachRow((row: any, rowNumber: number) => {
    if (rowNumber <= headerRowNum) return;
    const name = str(row, 'name');
    const nip = str(row, 'nip');
    const level = str(row, 'level');
    const contractTypeRaw = rawCell(row, 'contractType');
    const contractTimeRaw = rawCell(row, 'contractTime');
    const sector = str(row, 'sector');
    const hireDateRaw = rawCell(row, 'hireDate');
    const area = str(row, 'area');
    const basicSalaryRaw = rawCell(row, 'basicSalary');
    const hasAny =
      name || nip || level || sector || area ||
      (contractTypeRaw !== '' && contractTypeRaw !== null && contractTypeRaw !== undefined) ||
      (hireDateRaw !== '' && hireDateRaw !== null && hireDateRaw !== undefined) ||
      (contractTimeRaw !== '' && contractTimeRaw !== null && contractTimeRaw !== undefined) ||
      (basicSalaryRaw !== '' && basicSalaryRaw !== null && basicSalaryRaw !== undefined);
    if (!hasAny) return; // trailing blank
    rows.push({
      rowNumber,
      name: name || undefined,
      nip: nip || undefined,
      level: level || undefined,
      contractTypeRaw,
      contractTimeRaw,
      sector: sector || undefined,
      hireDateRaw,
      area: area || undefined,
      basicSalaryRaw,
    });
  });
  if (rows.length === 0) throw new Error('Tidak ada baris data di file');
  if (rows.length > 5000) throw new Error('Maksimal 5000 baris per import');
  return rows;
}

/** Template workbook: single 'Payroll' sheet, ONE header row, pre-filled with all
 * current employees (NAMA/NIP/LEVEL/BIDANG/MULAI KERJA/AREA/GAJI from the master;
 * JENIS + WAKTU KONTRAK left for HR to fill). Round-trips through the parser. */
export interface ContractImportPrefillRow {
  name: string;
  nip: string;
  level?: string | null;
  sector?: string | null;
  hireDate?: Date | null;
  area?: string | null;
  basicSalary?: number | null;
}

export async function buildContractImportTemplate(prefill: ContractImportPrefillRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const labels = CONTRACT_IMPORT_COLUMNS.map((c) => c.label);
  const data = wb.addWorksheet('Payroll');
  const header = data.addRow(labels);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F6F43' } };
  header.alignment = { vertical: 'middle' };
  for (const r of prefill) {
    data.addRow([
      r.name,
      r.nip,
      r.level ?? '',
      '', // JENIS — HR fills
      '', // WAKTU KONTRAK — HR fills
      r.sector ?? '',
      r.hireDate ?? '',
      r.area ?? '',
      r.basicSalary ?? '',
    ]);
  }
  data.columns = CONTRACT_IMPORT_COLUMNS.map(() => ({ width: 20 }));
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as any);
}

/** Excel serial (days since 1899-12-30) → JS Date. Returns null when unparseable. */
export function excelSerialToDate(v: any): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number' && Number.isFinite(v) && v > 20000 && v < 80000) {
    return new Date(Math.round((v - 25569) * 86400 * 1000));
  }
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s || s === '-') return null;
    const num = Number(s);
    if (Number.isFinite(num) && num > 20000 && num < 80000) {
      return new Date(Math.round((num - 25569) * 86400 * 1000));
    }
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Indonesian/US-tolerant number parse: 1400000 | "1.400.000" | "1,400,000". */
export function parseContractImportNumber(v: any): number | null {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v instanceof Date) return null;
  const s = String(v).trim().replace(/\s/g, '');
  if (!s || s === '-') return null;
  const direct = Number(s);
  if (Number.isFinite(direct)) return direct;
  const idFmt = Number(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(idFmt) ? idFmt : null;
}
