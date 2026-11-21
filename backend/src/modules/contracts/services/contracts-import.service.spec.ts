/**
 * IGDERP-271 — contract bulk import specs: payroll rows resolve against
 * masters (NIP = employeeCode, LEVEL split, SECTOR/AREA maps), valid rows
 * commit as caps-deferred drafts, activation gates on completeness + caps.
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

const HEADERS = ['NO', 'AREA', 'NAMA', 'LEVEL', 'NIP', 'JENIS KONTRAK', 'WAKTU KONTRAK', 'SECTOR', 'TANGGAL MASUK', 'GAJI POKOK'];

async function payrollBuffer(dataRows: any[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Payroll');
  ws.addRow(['BY MONTHS', '', '', '', '', '', '', '', '', '']);
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

/** Masters matching the dummy payroll rows. */
function stubMasters(prisma: any) {
  prisma.employee.findMany.mockResolvedValue([{ id: 'emp-1', employeeCode: 'IGD.23-0008' }]);
  prisma.position.findMany.mockResolvedValue([{ id: 'pos-tc2', code: 'TC-2' }, { id: 'pos-cs', code: 'CS' }]);
  prisma.grade.findMany.mockResolvedValue([{ id: 'g-2', code: 'G2' }]);
  prisma.division.findMany.mockResolvedValue([{ id: 'div-se', code: 'DIV-OPS-SE' }]);
  prisma.branch.findMany.mockResolvedValue([{ id: 'b-1', code: 'BR-001', name: 'IGD Jember Pusat', isActive: true }]);
  prisma.employee.findUnique.mockImplementation(async (a: any) =>
    a.where.employeeCode === 'IGD.23-0008' || a.where.id === 'emp-1' ? { id: 'emp-1' } : null,
  );
  prisma.position.findUnique.mockImplementation(async (a: any) =>
    a.where.code === 'TC-2' || a.where.id === 'pos-tc2'
      ? { id: 'pos-tc2' }
      : a.where.code === 'CS' || a.where.id === 'pos-cs'
        ? { id: 'pos-cs' }
        : null,
  );
  prisma.grade.findUnique.mockImplementation(async (a: any) =>
    a.where.code === 'G2' || a.where.id === 'g-2' ? { id: 'g-2' } : null,
  );
  prisma.division.findUnique.mockImplementation(async (a: any) =>
    a.where.code === 'DIV-OPS-SE' || a.where.id === 'div-se' ? { id: 'div-se' } : null,
  );
  prisma.branch.findUnique.mockImplementation(async (a: any) => (a.where.code === 'BR-001' ? { id: 'b-1' } : null));
}

const CLEAN_ROW = [1, 'BR-001', 'BINTANG PERMATA', 'TEKNISI-2', 'IGD.23-0008', 'ANNUAL', 46446, 'SALES', 45200, 1400000];

describe('ContractsImportService dryRun (IGDERP-271)', () => {
  it('resolves a clean payroll row (LEVEL split, maps, serial dates)', async () => {
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
      divisionCode: 'DIV-OPS-SE',
      basicSalary: 1400000,
    });
    expect(row.preview.branchCodes).toEqual(['BR-001']);
  });

  it('errors unknown NIP, flags unmapped AREA/division as incomplete', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    const res = await imports.dryRun(
      await payrollBuffer([
        [2, 'IGD JBR SRV', 'SLAMET', 'HEADSTORE (HS)', 'IGD.99-9999', 'LIFETIME', '-', 'SRV & SLS', 43466, 1200000],
      ]),
    );
    const row = res.rows[0];
    expect(row.status).toBe('error');
    expect(row.errors.join(' ')).toContain('IGD.99-9999');
    expect(row.preview.endDate).toBeNull();
  });

  it('splits "/" names and tolerates unknown grade suffixes', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    const res = await imports.dryRun(
      await payrollBuffer([
        [3, 'BR-001', 'MUHAMMAD RIDWAN/MEI DEWI', 'ADM/CS-ACE', 'IGD.23-0008', 'ANNUAL', 46446, 'SALES', 43101, 1400000],
      ]),
    );
    const row = res.rows[0];
    expect(row.status).toBe('ok');
    expect(row.name).toBe('MUHAMMAD RIDWAN');
    expect(row.notes.join(' ')).toContain('MEI DEWI');
    expect(row.preview.positionCode).toBe('CS');
    expect(row.incomplete).toContain('grade');
  });
});

describe('ContractsImportService commit (IGDERP-271)', () => {
  it('creates caps-deferred drafts with generated numbers', async () => {
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
    expect(res.created[0]).toMatchObject({ rowNumber: 3, nip: 'IGD.23-0008' });
    expect(res.skipped).toHaveLength(0);
    const data = prisma.contract.create.mock.calls[0][0].data;
    expect(data.status).toBe('draft');
    expect(data.type).toBe('pkwt');
    expect(data.contractBranches.create).toEqual([{ branchId: 'b-1', isPrimary: true }]);
    // Caps deferred: a 40-month PKWT draft commits without complaint.
    expect(prisma.contract.count).not.toHaveBeenCalled();
  });

  it('skips error rows and reports them', async () => {
    const { imports, prisma }: any = await boot();
    stubMasters(prisma);
    prisma.contract.create.mockImplementation(async ({ data }: any) => ({ id: 'c-x', contractNumber: 'CTR-X', ...data }));
    const res = await imports.commit(
      await payrollBuffer([
        CLEAN_ROW,
        [2, 'HQ', 'GHOST', 'TEKNISI-1', 'IGD.00-0000', 'ANNUAL', 46446, 'SALES', 45200, 1000000],
      ]),
    );
    expect(res.created).toHaveLength(1);
    expect(res.skipped).toHaveLength(1);
    expect(res.skipped[0].errors.join(' ')).toContain('IGD.00-0000');
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
        user: { fullName: 'BINTANG PERMATA' },
        position: { code: 'TEKNISI-2' },
        division: { code: 'SERVICE' },
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
    const buf = await imports.buildImportTemplate();
    const { parseContractImportBuffer } = require('../../../shared/utils/contract-import-template');
    const rows = await parseContractImportBuffer(buf);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: 'BINTANG PERMATA',
      nip: 'IGD.23-0008',
      level: 'TEKNISI-2',
    });
    expect(rows[0].basicSalaryRaw).toBe(1400000);
    // Nameless employee falls back to NIP so the row still matches on re-upload.
    expect(rows[1].name).toBe('IGD.19-0004');
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, deletedAt: null } }),
    );
  });
});
