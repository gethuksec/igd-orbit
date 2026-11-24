/**
 * IGDERP-271 + IGDERP-298 — contract bulk import-as-intake specs.
 * New 13-column shape: NIP = employeeCode, JABATAN + GRADE split,
 * TGL MULAI/SELESAI, EMAIL/NO HP (new NIP), GAJI + PENDIDIKAN required.
 * Unknown NIP runs the intake transaction; active-contract rows are
 * rejected (D1); valid rows commit as caps-deferred drafts.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../shared/services/prisma.service';
import { PasswordService } from '../../../shared/services/password.service';
import { ContractsService } from './contracts.service';
import { ContractsImportService } from './contracts-import.service';

const ExcelJS = require('exceljs');

function mockDelegate(extra: any = {}) {
  return {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(async () => []),
    count: jest.fn(async () => 0),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    ...extra,
  };
}

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

async function payrollBuffer(dataRows: any[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Payroll');
  ws.addRow(HEADERS);
  for (const r of dataRows) ws.addRow(r);
  return Buffer.from((await wb.xlsx.writeBuffer()) as any);
}

async function boot() {
  const delegates: any = {
    contract: mockDelegate(),
    contractBranch: mockDelegate(),
    contractWorkingLocation: mockDelegate(),
    employee: mockDelegate(),
    workingLocation: mockDelegate(),
    position: mockDelegate(),
    grade: mockDelegate(),
    division: mockDelegate(),
    department: mockDelegate(),
    branch: mockDelegate(),
    user: mockDelegate(),
    userBranch: mockDelegate(),
    role: mockDelegate(),
    $transaction: jest.fn(),
  };
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ContractsService,
      ContractsImportService,
      { provide: PrismaService, useValue: delegates },
      {
        provide: PasswordService,
        useValue: {
          validatePasswordStrength: jest.fn(() => ({ isValid: true })),
          hashPassword: jest.fn(async () => 'hashed'),
          generateStrongPassword: jest.fn(() => 'Temp#1234'),
        },
      },
    ],
  }).compile();
  return {
    imports: module.get(ContractsImportService),
    contracts: module.get(ContractsService),
    prisma: delegates,
  };
}

/** Masters matching the dummy rows. */
function stubMasters(prisma: any) {
  prisma.employee.findMany.mockResolvedValue([{ id: 'emp-1', employeeCode: 'IGD.23-0008' }]);
  prisma.user.findMany.mockResolvedValue([]);
  prisma.position.findMany.mockResolvedValue([
    { id: 'pos-tc2', code: 'TC-2', rank: 6, departmentId: 'dept-ops', divisionId: 'div-srv', isActive: true },
    { id: 'pos-hs', code: 'HS', rank: 4, departmentId: 'dept-ops', divisionId: null, isActive: true },
    { id: 'pos-cs', code: 'CS', rank: 6, departmentId: 'dept-ops', divisionId: 'div-srv', isActive: true },
  ]);
  prisma.grade.findMany.mockResolvedValue([{ id: 'g-2', code: 'G2' }]);
  prisma.division.findMany.mockResolvedValue([
    { id: 'div-srv', code: 'DIV-OPS-SRV' },
    { id: 'div-se', code: 'DIV-OPS-SE' },
  ]);
  prisma.department.findMany.mockResolvedValue([{ id: 'dept-ops', code: 'DEPT-OPS' }]);
  prisma.branch.findMany.mockResolvedValue([{ id: 'b-1', code: 'BR-001', name: 'IGD Jember Pusat', isActive: true }]);
  prisma.contract.findMany.mockResolvedValue([]); // no active contracts
  prisma.employee.findUnique.mockImplementation(async (a: any) =>
    a.where.employeeCode === 'IGD.23-0008' || a.where.id === 'emp-1' ? { id: 'emp-1' } : null,
  );
  prisma.position.findUnique.mockImplementation(async (a: any) =>
    a.where.code === 'TC-2' || a.where.id === 'pos-tc2'
      ? { id: 'pos-tc2', departmentId: 'dept-ops', divisionId: 'div-srv', isActive: true }
      : a.where.code === 'HS' || a.where.id === 'pos-hs'
        ? { id: 'pos-hs', departmentId: 'dept-ops', divisionId: null, isActive: true }
        : a.where.code === 'CS' || a.where.id === 'pos-cs'
          ? { id: 'pos-cs', departmentId: 'dept-ops', divisionId: 'div-srv', isActive: true }
          : null,
  );
  prisma.grade.findUnique.mockImplementation(async (a: any) =>
    a.where.code === 'G2' || a.where.id === 'g-2' ? { id: 'g-2' } : null,
  );
  prisma.division.findUnique.mockImplementation(async (a: any) =>
    a.where.code === 'DIV-OPS-SRV' || a.where.id === 'div-srv'
      ? { id: 'div-srv' }
      : a.where.code === 'DIV-OPS-SE' || a.where.id === 'div-se'
        ? { id: 'div-se' }
        : null,
  );
  prisma.department.findUnique.mockImplementation(async (a: any) =>
    a.where.code === 'DEPT-OPS' || a.where.id === 'dept-ops' ? { id: 'dept-ops' } : null,
  );
  prisma.branch.findUnique.mockImplementation(async (a: any) => (a.where.code === 'BR-001' ? { id: 'b-1' } : null));
  prisma.user.findUnique.mockResolvedValue(null);
}

const CLEAN_ROW = [
  'BINTANG PERMATA',
  'IGD.23-0008',
  '',
  '',
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

describe('ContractsImportService dryRun (IGDERP-298)', () => {
  it('resolves a clean row (JABATAN+GRADE split, division derived, edu+salaire)', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    const res = await imports.dryRun(await payrollBuffer([CLEAN_ROW]));
    expect(res.total).toBe(1);
    expect(res.valid).toBe(1);
    const row = res.rows[0];
    expect(row.status).toBe('ok');
    expect(row.errors).toEqual([]);
    expect(row.incomplete).toEqual([]);
    expect(row.preview).toMatchObject({
      type: 'pkwt',
      startDate: '2023-10-01',
      endDate: '2027-02-28',
      positionCode: 'TC-2',
      gradeCode: 'G2',
      divisionCode: 'DIV-OPS-SRV',
      departmentCode: 'DEPT-OPS',
      basicSalary: 1400000,
      education: 'SMA',
      isNew: false,
    });
    expect(row.preview.branchCodes).toEqual(['BR-001']);
  });

  it('marks unknown NIP as new, requiring EMAIL', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    const res = await imports.dryRun(
      await payrollBuffer([
        ['AYU LESTARI', 'IGD.26-0001', 'ayu@igd.local', '0811', 'TEKNISI', 1, '', 'TRIAL', 45200, 45290, 'BR-001', 1200000, 'S1'],
        ['TANPA EMAIL', 'IGD.26-0002', '', '', 'TEKNISI', 1, '', 'TRIAL', 45200, 45290, '', 1200000, 'SMA'],
      ]),
    );
    expect(res.rows[0].status).toBe('ok');
    expect(res.rows[0].preview.isNew).toBe(true);
    expect(res.rows[0].preview.email).toBe('ayu@igd.local');
    expect(res.rows[1].status).toBe('error');
    expect(res.rows[1].errors.join(' ')).toContain('EMAIL wajib');
  });

  it('rejects duplicate and already-registered emails for new rows', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    prisma.user.findMany.mockResolvedValue([{ id: 'u-taken', email: 'taken@igd.local' }]);
    const res = await imports.dryRun(
      await payrollBuffer([
        ['A SATU', 'IGD.26-0011', 'dup@igd.local', '', 'TEKNISI', 1, '', 'TRIAL', 45200, 45290, '', 1200000, 'SMA'],
        ['A DUA', 'IGD.26-0012', 'dup@igd.local', '', 'TEKNISI', 1, '', 'TRIAL', 45200, 45290, '', 1200000, 'SMA'],
        ['A TIGA', 'IGD.26-0013', 'taken@igd.local', '', 'TEKNISI', 1, '', 'TRIAL', 45200, 45290, '', 1200000, 'SMA'],
      ]),
    );
    expect(res.rows[0].status).toBe('error');
    expect(res.rows[0].errors.join(' ')).toContain('duplikat di file');
    expect(res.rows[1].status).toBe('error');
    expect(res.rows[2].errors.join(' ')).toContain('sudah terdaftar');
  });

  it('rejects rows touching employees with an active contract (D1)', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    prisma.contract.findMany.mockResolvedValue([{ employeeId: 'emp-1' }]);
    const res = await imports.dryRun(await payrollBuffer([CLEAN_ROW]));
    expect(res.valid).toBe(0);
    expect(res.rows[0].errors.join(' ')).toMatch(/aktif/);
  });

  it('requires GAJI POKOK and PENDIDIKAN TERAKHIR', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    const noSalary = [...CLEAN_ROW];
    noSalary[11] = '';
    const badEdu = [...CLEAN_ROW];
    badEdu[12] = 'DOKTORAL';
    const res = await imports.dryRun(await payrollBuffer([noSalary, badEdu]));
    expect(res.rows[0].errors.join(' ')).toContain('GAJI POKOK');
    expect(res.rows[1].errors.join(' ')).toContain('PENDIDIKAN TERAKHIR');
  });

  it('splits legacy combined LEVEL ("teknisi 2") without explicit GRADE', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    const legacy = [...CLEAN_ROW];
    legacy[4] = 'teknisi 2';
    legacy[5] = '';
    const res = await imports.dryRun(await payrollBuffer([legacy]));
    expect(res.rows[0].status).toBe('ok');
    expect(res.rows[0].preview.positionCode).toBe('TC-2');
    expect(res.rows[0].preview.gradeCode).toBe('G2');
  });

  it('heads resolve without grade (HS single row)', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    const head = [...CLEAN_ROW];
    head[4] = 'HEADSTORE';
    head[5] = '';
    const res = await imports.dryRun(await payrollBuffer([head]));
    expect(res.rows[0].status).toBe('ok');
    expect(res.rows[0].preview.positionCode).toBe('HS');
    expect(res.rows[0].preview.gradeCode).toBeNull();
    expect(res.rows[0].preview.divisionCode).toBeUndefined();
    expect(res.rows[0].preview.departmentCode).toBe('DEPT-OPS');
    expect(res.rows[0].incomplete).not.toContain('grade');
  });

  it('splits "/" names and tolerates unknown grade suffixes', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    const row = [...CLEAN_ROW];
    row[0] = 'MUHAMMAD RIDWAN/MEI DEWI';
    row[4] = 'ADM/CS';
    row[5] = 'ACE';
    const res = await imports.dryRun(await payrollBuffer([row]));
    expect(res.rows[0].status).toBe('ok');
    expect(res.rows[0].name).toBe('MUHAMMAD RIDWAN');
    expect(res.rows[0].notes.join(' ')).toContain('MEI DEWI');
    expect(res.rows[0].preview.positionCode).toBe('CS');
    expect(res.rows[0].incomplete).toContain('grade');
  });
});

describe('ContractsImportService commit (IGDERP-298)', () => {
  function stubTx(prisma: any, contractNumber = 'CTR-202611-ABCDEF') {
    const tx: any = {
      user: { create: jest.fn(async ({ data }: any) => ({ id: 'u-new', ...data })) },
      employee: {
        create: jest.fn(async ({ data }: any) => ({ id: 'emp-new', ...data })),
        findUniqueOrThrow: jest.fn(async () => ({ id: 'emp-new' })),
      },
      contract: { create: jest.fn(async ({ data }: any) => ({ id: 'c-new', contractNumber, ...data })) },
      userBranch: { create: jest.fn(async (a: any) => a.data) },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
    return tx;
  }

  it('creates caps-deferred drafts for existing employees', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    prisma.contract.findUnique.mockResolvedValue(null); // number availability
    prisma.contract.create.mockImplementation(async ({ data }: any) => ({
      id: 'c-new',
      contractNumber: 'CTR-202611-ABCDEF',
      ...data,
    }));
    const res = await imports.commit(await payrollBuffer([CLEAN_ROW]));
    expect(res.created).toHaveLength(1);
    expect(res.created[0]).toMatchObject({ rowNumber: 2, nip: 'IGD.23-0008' });
    expect(res.created[0].isNew).toBeFalsy();
    expect(res.created[0].tempPassword).toBeUndefined();
    expect(res.skipped).toHaveLength(0);
    const data = prisma.contract.create.mock.calls[0][0].data;
    expect(data.status).toBe('draft');
    expect(data.type).toBe('pkwt');
    expect(data.contractBranches.create).toEqual([{ branchId: 'b-1', isPrimary: true }]);
    // Caps deferred: a 40-month PKWT draft commits without complaint.
    expect(prisma.contract.count).not.toHaveBeenCalled();
  });

  it('provisions user + employee + draft for new NIPs with one-time password', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    prisma.contract.findUnique.mockResolvedValue(null);
    const tx = stubTx(prisma);
    const res = await imports.commit(
      await payrollBuffer([
        ['AYU LESTARI', 'IGD.26-0001', 'ayu@igd.local', '0811', 'TEKNISI', 2, '', 'TRIAL', 45200, 45290, 'BR-001', 1200000, 'S1'],
      ]),
    );
    expect(res.created).toHaveLength(1);
    expect(res.created[0].isNew).toBe(true);
    expect(res.created[0].tempPassword).toBe('Temp#1234');
    const userData = tx.user.create.mock.calls[0][0].data;
    expect(userData).toMatchObject({
      email: 'ayu@igd.local',
      phone: '0811',
      fullName: 'AYU LESTARI',
      passwordHash: 'hashed',
      mustChangePassword: true,
    });
    const empData = tx.employee.create.mock.calls[0][0].data;
    expect(empData).toMatchObject({ employeeCode: 'IGD.26-0001', education: 'S1' });
    expect(Number(empData.basicSalary)).toBe(1200000);
    const cData = tx.contract.create.mock.calls[0][0].data;
    expect(cData.status).toBe('draft');
    expect(cData.positionId).toBe('pos-tc2');
  });

  it('skips error rows and reports them', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    prisma.contract.create.mockImplementation(async ({ data }: any) => ({ id: 'c-x', contractNumber: 'CTR-X', ...data }));
    const ghost = [...CLEAN_ROW];
    ghost[1] = 'IGD.00-0000';
    ghost[2] = ''; // no email -> intake identity missing
    const res = await imports.commit(await payrollBuffer([CLEAN_ROW, ghost]));
    expect(res.created).toHaveLength(1);
    expect(res.skipped).toHaveLength(1);
    expect(res.skipped[0].errors.join(' ')).toMatch(/EMAIL wajib/);
  });
});

describe('ContractsService create (IGDERP-299 D1)', () => {
  it('rejects fresh rows for employees holding an active contract', async () => {
    const { contracts, prisma }: any = await boot();
    stubMasters(prisma);
    prisma.contract.findFirst.mockResolvedValue({ id: 'c-active', status: 'active' });
    await expect(
      contracts.create({ employeeId: 'emp-1', type: 'pkwt', startDate: '2026-01-01', endDate: '2026-12-31' } as any),
    ).rejects.toThrow(/aktif/);
  });

  it('allows renewals linked via previousContractId', async () => {
    const { contracts, prisma }: any = await boot();
    stubMasters(prisma);
    prisma.contract.findUnique.mockImplementation(async (a: any) => {
      if (a.where?.id === 'c-prev') return { id: 'c-prev', employeeId: 'emp-1' };
      if (a.where?.contractNumber) return null;
      return { id: 'emp-1' };
    });
    prisma.contract.findFirst.mockResolvedValue({ id: 'c-active', status: 'active' });
    prisma.contract.create.mockImplementation(async ({ data }: any) => ({ id: 'c-new', ...data }));
    const made = await contracts.create(
      { employeeId: 'emp-1', type: 'pkwt', startDate: '2026-01-01', endDate: '2026-06-30', previousContractId: 'c-prev' } as any,
      { deferCaps: true },
    );
    expect(made.id).toBe('c-new');
  });
});

describe('ContractsService activation gate (IGDERP-271)', () => {
  function draftExisting(over: any = {}) {
    return {
      id: 'c-draft',
      status: 'draft',
      employeeId: 'emp-1',
      type: 'pkwt',
      startDate: new Date('2023-10-01'),
      endDate: new Date('2024-09-30'),
      positionId: 'pos-tc2',
      gradeId: 'g-2',
      basicSalary: 1400000,
      contractWorkingLocations: [{ workingLocationId: 'wl-1' }],
      contractBranches: [{ branchId: 'b-1' }],
      ...over,
    };
  }

  it('refuses activation of incomplete drafts', async () => {
    const { contracts, prisma }: any = await boot();
    prisma.contract.findUnique.mockResolvedValue(
      draftExisting({ positionId: null, gradeId: null, basicSalary: null, contractWorkingLocations: [], contractBranches: [] }),
    );
    await expect(contracts.update('c-draft', { status: 'active' } as any)).rejects.toThrow(
      /working locations.*position.*grade.*basic salary.*penempatan/,
    );
  });

  it('activates complete drafts, links the chain and enforces caps', async () => {
    const { contracts, prisma }: any = await boot();
    prisma.contract.findUnique.mockResolvedValue(draftExisting());
    prisma.contract.count.mockResolvedValue(0);
    const tx: any = {
      contractWorkingLocation: mockDelegate(),
      contractBranch: mockDelegate(),
      contract: {
        ...mockDelegate(),
        findFirst: jest.fn(async () => ({ id: 'c-prev', status: 'active' })),
        update: jest.fn(async (a: any) => ({ id: a.where.id, ...a.data })),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(tx));
    const updated = await contracts.update('c-draft', { status: 'active' } as any);
    expect(updated.status).toBe('active');
    expect(updated.previousContractId).toBe('c-prev');
    expect(updated.changeReason).toBe('renewal');
    expect(tx.contract.update).toHaveBeenCalledWith({ where: { id: 'c-prev' }, data: { status: 'renewed' } });
  });

  it('rejects activation that breaks stage caps', async () => {
    const { contracts, prisma }: any = await boot();
    prisma.contract.findUnique.mockResolvedValue(
      draftExisting({ endDate: new Date('2027-12-31') }), // >12mo PKWT
    );
    await expect(contracts.update('c-draft', { status: 'active' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects ref edits on active contracts', async () => {
    const { contracts, prisma }: any = await boot();
    prisma.contract.findUnique.mockResolvedValue({ ...draftExisting(), status: 'active' });
    await expect(contracts.update('c-draft', { positionId: 'pos-x' } as any)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('buildImportTemplate', () => {
  it('pre-fills all current employees with master data, sorted by name', async () => {
    const { imports, prisma }: any = await boot();
    prisma.employee.findMany.mockResolvedValue([
      {
        employeeCode: 'IGD.23-0008',
        hireDate: new Date('2023-10-01'),
        basicSalary: '1400000.00',
        user: { fullName: 'BINTANG PERMATA', email: 'bintang@igd.local', phone: '0811' },
        position: { code: 'TC-2' },
        division: { code: 'DIV-OPS-SRV' },
        branch: { code: 'BR-001' },
      },
      {
        employeeCode: 'IGD.19-0004',
        hireDate: new Date('2019-01-01'),
        basicSalary: null,
        user: { fullName: null },
        position: null,
        division: null,
        branch: null,
      },
    ]);
    prisma.branch.findMany.mockResolvedValue([{ code: 'BR-001', name: 'IGD Jember Pusat' }]);
    prisma.position.findMany.mockResolvedValue([
      { code: 'TC-2', name: 'STAFF TEKNISI', rank: 6, departmentId: 'd1', divisionId: 'v1' },
    ]);
    prisma.department.findMany.mockResolvedValue([{ id: 'd1', code: 'DEPT-OPS' }]);
    prisma.division.findMany.mockResolvedValue([{ id: 'v1', code: 'DIV-OPS-SRV' }]);
    const buf = await imports.buildImportTemplate();
    const { parseContractImportBuffer } = require('../../../shared/utils/contract-import-template');
    const rows = await parseContractImportBuffer(buf);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: 'BINTANG PERMATA',
      nip: 'IGD.23-0008',
      jabatan: 'TC',
      grade: '2',
    });
    expect(rows[0].basicSalaryRaw).toBe(1400000);
    // Nameless employee falls back to NIP so the row still matches on re-upload.
    expect(rows[1].name).toBe('IGD.19-0004');
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, deletedAt: null } }),
    );
  });
});
