/**
 * IGDERP-298 — contract bulk import-as-intake workbook.
 *
 * Main sheet `Payroll` (single header row, `*` = required — the parser
 * strips stars so old files still load):
 *   NAMA* | NIP* | EMAIL | NO HP | JABATAN* | GRADE* | DIVISI |
 *   JENIS KONTRAK* | TGL MULAI* | TGL SELESAI | AREA | GAJI POKOK* |
 *   PENDIDIKAN TERAKHIR*
 * - EMAIL required for new-NIP rows, ignored for existing NIP.
 * - GRADE 1-6, blank only for L0-L5 heads (MM/MO/MS/MU/HS/SPV…).
 * - DIVISI optional override (auto-derived from JABATAN otherwise).
 * - TGL SELESAI empty for PKWTT. Legacy headers still parse:
 *   LEVEL→JABATAN (combined "teknisi 2" split in the service),
 *   SECTOR→DIVISI, TANGGAL MASUK→TGL MULAI, WAKTU KONTRAK→TGL SELESAI.
 * Reference sheets: `Daftar Outlet`, `Daftar Jabatan`, `Daftar Pendidikan`.
 *
 * Pure parse only (no DB, no writes): returns raw rows; the import service
 * resolves masters and reports misses — imports land as drafts (existing
 * NIP) or single-intake rows (new NIP, IGDERP-298).
 */
const ExcelJS = require('exceljs');

export interface ContractImportColumnDef {
  key:
    | 'name'
    | 'nip'
    | 'email'
    | 'phone'
    | 'jabatan'
    | 'grade'
    | 'divisi'
    | 'contractType'
    | 'startDate'
    | 'endDate'
    | 'area'
    | 'basicSalary'
    | 'education';
  label: string;
  aliases: string[];
  required: boolean;
}

export const CONTRACT_IMPORT_COLUMNS: ContractImportColumnDef[] = [
  {
    key: 'name',
    label: 'NAMA*',
    aliases: ['nama', 'name', 'namakaryawan', 'nama_karyawan', 'fullname', 'nama_lengkap'],
    required: true,
  },
  {
    key: 'nip',
    label: 'NIP*',
    aliases: ['nip', 'employeecode', 'employee_code', 'kodekaryawan', 'kode_karyawan', 'nik', 'nomorinduk'],
    required: true,
  },
  {
    key: 'email',
    label: 'EMAIL',
    aliases: ['email', 'e-mail', 'surel', 'emailkaryawan'],
    required: false,
  },
  {
    key: 'phone',
    label: 'NO HP',
    aliases: ['nohp', 'hp', 'phone', 'no_hp', 'nomorhp', 'nomor_hp', 'telepon', 'telp', 'whatsapp', 'wa'],
    required: false,
  },
  {
    key: 'jabatan',
    label: 'JABATAN*',
    // 'level'/'posisi' kept for legacy payroll sheets — a combined value
    // like "teknisi 2" is split into jabatan + grade by the service.
    aliases: ['jabatan', 'posisi', 'title', 'level', 'levelhead', 'jabatantitle'],
    required: true,
  },
  {
    key: 'grade',
    label: 'GRADE*',
    aliases: ['grade', 'g', 'gradelevel', 'tingkat', 'golongan', 'grades'],
    required: true,
  },
  {
    key: 'divisi',
    label: 'DIVISI',
    aliases: ['divisi', 'division', 'sector', 'sektor', 'bidang', 'departemen', 'dept'],
    required: false,
  },
  {
    key: 'contractType',
    label: 'JENIS KONTRAK*',
    aliases: ['jeniskontrak', 'jenis_kontrak', 'contracttype', 'tipekontrak', 'tipe_kontrak', 'jeniskontrakkerja'],
    required: true,
  },
  {
    key: 'startDate',
    label: 'TGL MULAI*',
    aliases: [
      'tglmulai', 'tanggalmulai', 'tanggal_mulai',
      'tanggalmasuk', 'tanggal_masuk', 'hiredate', 'tglmasuk', 'tgl_masuk', 'startdate',
    ],
    required: true,
  },
  {
    key: 'endDate',
    label: 'TGL SELESAI',
    aliases: ['tglselesai', 'tanggalselesai', 'waktukontrak', 'waktu_kontrak', 'kontrakberakhir', 'berakhir', 'enddate', 'contractend', 'masakontrak'],
    required: false,
  },
  {
    key: 'area',
    label: 'AREA',
    aliases: ['area', 'penempatan', 'outlet', 'branch', 'cabang', 'lokasi', 'penempatanoutlet'],
    required: false,
  },
  {
    key: 'basicSalary',
    label: 'GAJI POKOK*',
    aliases: ['gajipokok', 'gaji_pokok', 'basicsalary', 'gaji', 'salary', 'pokok'],
    required: true,
  },
  {
    key: 'education',
    label: 'PENDIDIKAN TERAKHIR*',
    aliases: ['pendidikanterakhir', 'pendidikan_terakhir', 'pendidikan', 'education', 'jenjang', 'jenjangpendidikan', 'pendidikanformal'],
    required: true,
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
  email?: string;
  phone?: string;
  jabatan?: string;
  grade?: string;
  divisi?: string;
  contractTypeRaw: any;
  startDateRaw: any;
  endDateRaw: any;
  area?: string;
  basicSalaryRaw: any;
  education?: string;
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
    const email = str(row, 'email');
    const phone = str(row, 'phone');
    const jabatan = str(row, 'jabatan');
    const grade = str(row, 'grade');
    const divisi = str(row, 'divisi');
    const contractTypeRaw = rawCell(row, 'contractType');
    const startDateRaw = rawCell(row, 'startDate');
    const endDateRaw = rawCell(row, 'endDate');
    const area = str(row, 'area');
    const basicSalaryRaw = rawCell(row, 'basicSalary');
    const education = str(row, 'education');
    const hasAny =
      name || nip || email || phone || jabatan || grade || divisi || area || education ||
      (contractTypeRaw !== '' && contractTypeRaw !== null && contractTypeRaw !== undefined) ||
      (startDateRaw !== '' && startDateRaw !== null && startDateRaw !== undefined) ||
      (endDateRaw !== '' && endDateRaw !== null && endDateRaw !== undefined) ||
      (basicSalaryRaw !== '' && basicSalaryRaw !== null && basicSalaryRaw !== undefined);
    if (!hasAny) return; // trailing blank
    rows.push({
      rowNumber,
      name: name || undefined,
      nip: nip || undefined,
      email: email || undefined,
      phone: phone || undefined,
      jabatan: jabatan || undefined,
      grade: grade || undefined,
      divisi: divisi || undefined,
      contractTypeRaw,
      startDateRaw,
      endDateRaw,
      area: area || undefined,
      basicSalaryRaw,
      education: education || undefined,
    });
  });
  if (rows.length === 0) throw new Error('Tidak ada baris data di file');
  if (rows.length > 5000) throw new Error('Maksimal 5000 baris per import');
  return rows;
}

/** Pendidikan jenjang reference (IGDERP-298; full master lands with D9). */
export interface EducationLevelDef {
  code: string;
  name: string;
  aliases: string[];
}

export const EDUCATION_LEVELS: EducationLevelDef[] = [
  { code: 'SD', name: 'SD', aliases: ['sd', 'sekolahdasar'] },
  { code: 'SMP', name: 'SMP', aliases: ['smp', 'sltp', 'sekolahmenengahpertama'] },
  { code: 'SMA', name: 'SMA', aliases: ['sma', 'smu', 'slta', 'sekolahmenengahatas'] },
  { code: 'SMK', name: 'SMK', aliases: ['smk', 'sekolahmenengahkejuruan'] },
  { code: 'D3', name: 'D3', aliases: ['d3', 'diploma', 'diploma3', 'akademi'] },
  { code: 'S1', name: 'S1', aliases: ['s1', 'sarjana', 'strata1', 'sarjana1'] },
  { code: 'S2', name: 'S2', aliases: ['s2', 'magister', 'strata2', 'pascasarjana'] },
  { code: 'S3', name: 'S3', aliases: ['s3', 'doktor', 'strata3'] },
];

const normEdu = (v: any) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/[_\s./-]+/g, '');

/** Normalize a PENDIDIKAN TERAKHIR* cell to a jenjang code, or null. */
export function normalizeEducation(v: any): string | null {
  const n = normEdu(v);
  if (!n) return null;
  for (const lvl of EDUCATION_LEVELS) {
    if (n === normEdu(lvl.code) || lvl.aliases.includes(n)) return lvl.code;
  }
  return null;
}

export interface ContractImportOutletRef {
  code: string;
  name: string;
}

export interface ContractImportTitleRef {
  code: string;
  name: string;
  departmentCode?: string | null;
  divisionCode?: string | null;
  grades: string; // e.g. '1-6' for staff titles, '—' for single-row heads
}

/** Template workbook: `Payroll` + 3 reference sheets, ONE header row. */
export interface ContractImportPrefillRow {
  name: string;
  nip: string;
  email?: string | null;
  phone?: string | null;
  jabatan?: string | null;
  grade?: string | null;
  divisi?: string | null;
  startDate?: Date | null;
  area?: string | null;
  basicSalary?: number | null;
  education?: string | null;
}

export interface ContractImportTemplateRefs {
  outlets: ContractImportOutletRef[];
  titles: ContractImportTitleRef[];
}

const REQUIRED_RED = 'FFFF0000';
const HEADER_FILL = 'FF1F6F43';

export async function buildContractImportTemplate(
  prefill: ContractImportPrefillRow[],
  refs: ContractImportTemplateRefs = { outlets: [], titles: [] },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const data = wb.addWorksheet('Payroll');

  const labels = CONTRACT_IMPORT_COLUMNS.map((c) => c.label);
  const header = data.addRow(labels);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: 'middle' };
  // Mandatory columns marked red (client request).
  CONTRACT_IMPORT_COLUMNS.forEach((c, i) => {
    if (c.required) header.getCell(i + 1).font = { bold: true, color: { argb: REQUIRED_RED } };
  });

  // Column order follows CONTRACT_IMPORT_COLUMNS.
  for (const r of prefill) {
    data.addRow([
      r.name,
      r.nip,
      r.email ?? '',
      r.phone ?? '',
      r.jabatan ?? '',
      r.grade ?? '',
      r.divisi ?? '',
      '', // JENIS KONTRAK — HR fills
      r.startDate ?? '',
      '', // TGL SELESAI — HR fills
      r.area ?? '',
      r.basicSalary ?? '',
      r.education ?? '',
    ]);
  }
  data.columns = CONTRACT_IMPORT_COLUMNS.map(() => ({ width: 20 }));

  // Reference sheets for dropdown validation.
  const outletWs = wb.addWorksheet('Daftar Outlet');
  outletWs.addRow(['KODE', 'NAMA']);
  for (const o of refs.outlets) outletWs.addRow([o.code, o.name]);
  outletWs.columns = [{ width: 18 }, { width: 36 }];

  const titleWs = wb.addWorksheet('Daftar Jabatan');
  titleWs.addRow(['KODE JABATAN', 'NAMA', 'DEPT', 'DIVISI', 'GRADE']);
  for (const t of refs.titles) {
    titleWs.addRow([t.code, t.name, t.departmentCode ?? '', t.divisionCode ?? '', t.grades]);
  }
  titleWs.columns = [{ width: 16 }, { width: 34 }, { width: 14 }, { width: 16 }, { width: 10 }];

  const eduWs = wb.addWorksheet('Daftar Pendidikan');
  eduWs.addRow(['JENJANG']);
  for (const lvl of EDUCATION_LEVELS) eduWs.addRow([lvl.code]);
  eduWs.columns = [{ width: 18 }];

  // Dropdown validations on the main sheet (rows 2..5001).
  const lastRow = Math.max(prefill.length + 1, 2) + 4000;
  const colLetter = (key: ContractImportColumnDef['key']) => {
    const idx = CONTRACT_IMPORT_COLUMNS.findIndex((c) => c.key === key);
    return idx >= 0 ? String.fromCharCode('A'.charCodeAt(0) + idx) : null;
  };
  try {
    const jabCol = colLetter('jabatan');
    if (jabCol && refs.titles.length > 0) {
      data.dataValidations.add(`${jabCol}2:${jabCol}${lastRow}`, {
        type: 'list',
        allowBlank: false,
        showErrorMessage: true,
        formulae: [`'Daftar Jabatan'!$A$2:$A$${refs.titles.length + 1}`],
      });
    }
    const gradeCol = colLetter('grade');
    if (gradeCol) {
      data.dataValidations.add(`${gradeCol}2:${gradeCol}${lastRow}`, {
        type: 'whole',
        operator: 'between',
        allowBlank: true,
        showErrorMessage: true,
        formulae: [1, 6],
      });
    }
    const eduCol = colLetter('education');
    if (eduCol) {
      data.dataValidations.add(`${eduCol}2:${eduCol}${lastRow}`, {
        type: 'list',
        allowBlank: false,
        showErrorMessage: true,
        formulae: [`'Daftar Pendidikan'!$A$2:$A$${EDUCATION_LEVELS.length + 1}`],
      });
    }
  } catch {
    // Validation is best-effort UX — the service re-validates every row.
  }

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
