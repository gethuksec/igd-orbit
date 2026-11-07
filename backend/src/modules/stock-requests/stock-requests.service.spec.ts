import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { StockRequestsService } from './stock-requests.service';

describe('StockRequestsService', () => {
  let service: StockRequestsService;
  let prisma: any;

  const branch = { id: 'branch-1', code: 'JBR', name: 'Jember', isActive: true };
  const product = {
    id: 'prod-1',
    name: 'LCD + TS iPhone 11',
    categoryId: 'cat-1',
    isActive: true,
    deletedAt: null,
    category: { id: 'cat-1', name: 'LCD+TS' },
  };

  const existItem = (overrides: any = {}) => ({
    barcode: 'LCDIP11',
    listing: 'EXIST',
    productId: 'prod-1',
    quantity: 2,
    ...overrides,
  });
  const newItem = (overrides: any = {}) => ({
    barcode: '-',
    listing: 'NEW',
    productName: 'LCD + TS Oppo A58',
    categoryName: 'Perekat',
    quantity: 1,
    ...overrides,
  });
  const dto = (overrides: any = {}) => ({
    staffName: 'Aldi',
    customerType: 'USER',
    items: [existItem()],
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      branch: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      user: { findFirst: jest.fn(), findMany: jest.fn() },
      product: { findUnique: jest.fn(), findMany: jest.fn() },
      productStock: { aggregate: jest.fn() },
      category: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
      customer: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      stockRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockRequestsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get<StockRequestsService>(StockRequestsService);
  });

  function mockBranchOk() {
    prisma.branch.findUnique.mockResolvedValue(branch);
  }

  describe('createIntake', () => {
    it('creates a SUBMITTED request with EXIST + NEW mix', async () => {
      mockBranchOk();
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.stockRequest.findUnique.mockResolvedValue(null); // number free
      prisma.stockRequest.create.mockImplementation(async ({ data }: any) => ({
        id: 'req-1',
        ...data,
        items: data.items.create.map((r: any, i: number) => ({ id: `item-${i}`, ...r })),
      }));

      const res: any = await service.createIntake('tok', dto({ items: [existItem(), newItem()] }));

      expect(res.requestNumber).toMatch(/^REQ-\d{8}-\d{6}$/);
      expect(res.status).toBe('SUBMITTED');
      expect(res.staffUserId).toBe('user-1');
      expect(res.items).toHaveLength(2);
      expect(res.items[0]).toMatchObject({
        listing: 'EXIST',
        productId: 'prod-1',
        productName: 'LCD + TS iPhone 11',
        categoryId: 'cat-1',
        categoryName: 'LCD+TS',
        quantity: 2,
        sortOrder: 0,
      });
      expect(res.items[1]).toMatchObject({
        listing: 'NEW',
        productId: null,
        productName: 'LCD + TS Oppo A58',
        categoryName: 'Perekat',
        sortOrder: 1,
      });
      expect(res.outlet).toEqual({ id: 'branch-1', code: 'JBR', name: 'Jember' });
    });

    it('persists trimmed item note, null when absent', async () => {
      mockBranchOk();
      prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.stockRequest.findUnique.mockResolvedValue(null);
      prisma.stockRequest.create.mockImplementation(async ({ data }: any) => ({
        id: 'req-1',
        ...data,
        items: data.items.create.map((r: any, i: number) => ({ id: `item-${i}`, ...r })),
      }));

      const res: any = await service.createIntake(
        'tok',
        dto({ items: [existItem({ note: '  warna hitam, minta 2 pcs  ' }), existItem({ productId: 'prod-1' })] }),
      );
      expect(res.items[0].note).toBe('warna hitam, minta 2 pcs');
      expect(res.items[1].note).toBeNull();
    });

    it('rejects unknown outlet token', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);
      await expect(service.createIntake('bad', dto())).rejects.toThrow(NotFoundException);
    });

    it('rejects EXIST row without productId', async () => {
      mockBranchOk();
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.createIntake('tok', dto({ items: [existItem({ productId: undefined })] })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.stockRequest.create).not.toHaveBeenCalled();
    });

    it('rejects EXIST row with unknown product', async () => {
      mockBranchOk();
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.createIntake('tok', dto())).rejects.toThrow(
        /tidak ditemukan di master/,
      );
    });

    it('rejects NEW row without product name', async () => {
      mockBranchOk();
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.createIntake('tok', dto({ items: [newItem({ productName: '  ' })] })),
      ).rejects.toThrow(/nama produk baru wajib/);
    });

    it('requires memberRef for MEMBER type', async () => {
      mockBranchOk();
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.createIntake('tok', dto({ customerType: 'MEMBER' })),
      ).rejects.toThrow(/member wajib/);
    });

    it('resolves memberId on exact customerCode match', async () => {
      mockBranchOk();
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-1', isActive: true });
      prisma.stockRequest.findUnique.mockResolvedValue(null);
      prisma.stockRequest.create.mockImplementation(async ({ data }: any) => ({ id: 'r', ...data }));
      const res: any = await service.createIntake(
        'tok',
        dto({ customerType: 'MEMBER', memberRef: 'MBR-001' }),
      );
      expect(res.memberId).toBe('cust-1');
      expect(res.memberRef).toBe('MBR-001');
    });
  });

  describe('updateStatus', () => {
    const stored = (status: string, extra: any = {}) => ({
      id: 'req-1',
      status,
      poNumber: null,
      ...extra,
    });

    beforeEach(() => {
      prisma.stockRequest.update.mockImplementation(async ({ data }: any) => ({
        id: 'req-1',
        ...data,
      }));
    });

    it('approves SUBMITTED → APPROVED with decidedBy', async () => {
      prisma.stockRequest.findUnique.mockResolvedValue(stored('SUBMITTED'));
      const res: any = await service.updateStatus('req-1', { status: 'APPROVED' } as any, 'sodo-1');
      expect(res.status).toBe('APPROVED');
      expect(res.decidedBy).toBe('sodo-1');
    });

    it('rejects without reason', async () => {
      prisma.stockRequest.findUnique.mockResolvedValue(stored('SUBMITTED'));
      await expect(
        service.updateStatus('req-1', { status: 'REJECTED' } as any, 'sodo-1'),
      ).rejects.toThrow(/wajib diisi/);
    });

    it('rejects with reason and stores cancelReason', async () => {
      prisma.stockRequest.findUnique.mockResolvedValue(stored('SUBMITTED'));
      const res: any = await service.updateStatus(
        'req-1',
        { status: 'REJECTED', reason: 'Qty tidak wajar' } as any,
        'sodo-1',
      );
      expect(res.status).toBe('REJECTED');
      expect(res.cancelReason).toBe('Qty tidak wajar');
    });

    it('rejects REJECTED from non-SUBMITTED', async () => {
      prisma.stockRequest.findUnique.mockResolvedValue(stored('APPROVED'));
      await expect(
        service.updateStatus('req-1', { status: 'REJECTED', reason: 'x' } as any),
      ).rejects.toThrow(/Hanya request Submitted/);
    });

    it('rejects backward transition APPROVED → SUBMITTED', async () => {
      prisma.stockRequest.findUnique.mockResolvedValue(stored('APPROVED'));
      await expect(
        service.updateStatus('req-1', { status: 'SUBMITTED' } as any),
      ).rejects.toThrow(/tidak diizinkan/);
    });

    it('requires poNumber before CHECKOUT', async () => {
      prisma.stockRequest.findUnique.mockResolvedValue(stored('WAITING_FOR_PO'));
      await expect(service.updateStatus('req-1', { status: 'CHECKOUT' } as any)).rejects.toThrow(
        /Nomor PO wajib/,
      );
      const res: any = await service.updateStatus(
        'req-1',
        { status: 'CHECKOUT', poNumber: 'PO-1' } as any,
      );
      expect(res.status).toBe('CHECKOUT');
      expect(res.poNumber).toBe('PO-1');
    });

    it('cancels from IN_TRANSIT with reason', async () => {
      prisma.stockRequest.findUnique.mockResolvedValue(stored('IN_TRANSIT'));
      const res: any = await service.updateStatus(
        'req-1',
        { status: 'CANCELLED', reason: 'Customer batal' } as any,
      );
      expect(res.status).toBe('CANCELLED');
      expect(res.cancelReason).toBe('Customer batal');
    });

    it('freezes terminal RECEIVED', async () => {
      prisma.stockRequest.findUnique.mockResolvedValue(stored('RECEIVED'));
      await expect(
        service.updateStatus('req-1', { status: 'CANCELLED', reason: 'x' } as any),
      ).rejects.toThrow(/tidak bisa diubah/);
    });

    it('404 on unknown id', async () => {
      prisma.stockRequest.findUnique.mockResolvedValue(null);
      await expect(service.updateStatus('nope', { status: 'APPROVED' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rotateIntakeToken', () => {
    it('issues a fresh unguessable token', async () => {
      prisma.branch.findUnique.mockResolvedValue({ ...branch, intakeSlug: 'jember-ab12' });
      prisma.branch.update.mockImplementation(async ({ data }: any) => ({ ...branch, ...data }));
      const res = await service.rotateIntakeToken('branch-1');
      expect(res.intakeToken).toMatch(/^[0-9a-f]{48}$/);
      expect(res.branchId).toBe('branch-1');
    });

    it('keeps the slug stable across rotations', async () => {
      prisma.branch.findUnique.mockResolvedValue({ ...branch, intakeSlug: 'jember-ab12' });
      prisma.branch.update.mockImplementation(async ({ data }: any) => ({ ...branch, ...data }));
      const res = await service.rotateIntakeToken('branch-1');
      expect(res.intakeSlug).toBe('jember-ab12');
      expect(res.intakePath).toBe('/r/jember-ab12');
      expect(prisma.branch.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'branch-1' } }),
      );
    });

    it('backfills a slug for legacy outlets missing one', async () => {
      prisma.branch.findUnique
        .mockResolvedValueOnce({ ...branch, intakeSlug: null })
        .mockResolvedValue(null); // no slug clash
      prisma.branch.update.mockImplementation(async ({ data }: any) => ({ ...branch, ...data }));
      const res = await service.rotateIntakeToken('branch-1');
      expect(res.intakeSlug).toMatch(/^jember-[0-9a-z]{4}$/);
      expect(res.intakePath).toBe(`/r/${res.intakeSlug}`);
    });

    it('404 on unknown branch', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);
      await expect(service.rotateIntakeToken('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listIntakeLinks', () => {
    it('returns only active outlets with their tokens', async () => {
      prisma.branch.findMany.mockResolvedValue([
        { id: 'b1', code: 'BR-001', name: 'Jember Pusat', intakeToken: 'tok1', intakeSlug: 'jember-pusat-x7k2' },
        { id: 'b2', code: 'BR-002', name: 'Kalisat', intakeToken: null, intakeSlug: null },
      ]);
      const res = await service.listIntakeLinks();
      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
      expect(res).toEqual([
        { branchId: 'b1', branchCode: 'BR-001', branchName: 'Jember Pusat', intakeToken: 'tok1', intakeSlug: 'jember-pusat-x7k2', intakePath: '/r/jember-pusat-x7k2' },
        { branchId: 'b2', branchCode: 'BR-002', branchName: 'Kalisat', intakeToken: null, intakeSlug: null, intakePath: null },
      ]);
    });
  });

  describe('searchIntakeCustomers', () => {
    it('returns [] on empty query without hitting customer table', async () => {
      mockBranchOk();
      const res = await service.searchIntakeCustomers('tok', '  ');
      expect(res).toEqual([]);
      expect(prisma.customer.findMany).not.toHaveBeenCalled();
    });

    it('rejects unknown outlet token', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);
      await expect(service.searchIntakeCustomers('nope', 'budi')).rejects.toThrow(NotFoundException);
    });

    it('searches by name/WA with PII-light select', async () => {
      mockBranchOk();
      prisma.customer.findMany.mockResolvedValue([
        { id: 'c1', name: 'Budi Santoso', phone: '081234567890', subdistrict: 'Kaliwates' },
      ]);
      const res = await service.searchIntakeCustomers('tok', 'budi');
      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 15 }),
      );
      expect(res).toEqual([
        { id: 'c1', name: 'Budi Santoso', phone: '081234567890', subdistrict: 'Kaliwates' },
      ]);
    });
  });

  describe('searchIntakeProducts', () => {
    const row = {
      id: 'prod-1',
      name: 'LCD + TS iPhone 11',
      sku: 'SKU-1',
      barcode: 'BC-1',
      categoryId: 'cat-1',
      category: { id: 'cat-1', name: 'LCD+TS' },
    };

    it('returns default top list on empty query (dropdown on focus)', async () => {
      mockBranchOk();
      prisma.product.findMany.mockResolvedValue([row]);
      prisma.productStock.aggregate.mockResolvedValue({ _sum: { quantityAvailable: 3 } });
      const res = await service.searchIntakeProducts('tok', '');
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true, deletedAt: null } }),
      );
      expect(res).toEqual([
        { id: 'prod-1', name: 'LCD + TS iPhone 11', sku: 'SKU-1', barcode: 'BC-1', category: row.category, available: 3 },
      ]);
    });

    it('filters by name/sku/barcode on typed query', async () => {
      mockBranchOk();
      prisma.product.findMany.mockResolvedValue([]);
      const res = await service.searchIntakeProducts('tok', 'lcd');
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) }),
      );
      expect(res).toEqual([]);
    });
  });

  describe('quickAddIntakeCustomer', () => {
    it('creates a retail master row on valid input', async () => {
      mockBranchOk();
      prisma.customer.findUnique.mockResolvedValue(null); // code free
      prisma.customer.create.mockImplementation(async ({ data }: any) => ({ id: 'c9', ...data }));
      const res = await service.quickAddIntakeCustomer('tok', {
        name: 'Ibu Rina',
        phone: '081234567890',
        subdistrict: 'Sumbersari',
      } as any);
      expect(res.id).toBe('c9');
      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ customerType: 'retail', name: 'Ibu Rina' }),
        }),
      );
    });

    it('rejects invalid WA', async () => {
      mockBranchOk();
      await expect(
        service.quickAddIntakeCustomer('tok', { name: 'X', phone: '123', subdistrict: 'Sumbersari' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unknown kecamatan', async () => {
      mockBranchOk();
      await expect(
        service.quickAddIntakeCustomer('tok', { name: 'X', phone: '081234567890', subdistrict: 'Bogor' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createIntake with customerId', () => {
    it('resolves picker-selected customer', async () => {
      mockBranchOk();
      prisma.customer.findUnique.mockResolvedValue({ id: 'cust-9', name: 'Budi', isActive: true });
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.stockRequest.findUnique.mockResolvedValue(null);
      prisma.stockRequest.create.mockImplementation(async ({ data }: any) => ({
        id: 'req-9',
        ...data,
        items: data.items.create.map((r: any, i: number) => ({ id: `item-${i}`, ...r })),
      }));
      const res: any = await service.createIntake(
        'tok',
        dto({ customerId: 'cust-9', customerType: undefined, items: [existItem()] }),
      );
      expect(res.memberId).toBe('cust-9');
      expect(res.memberRef).toBe('Budi');
    });

    it('404s on unknown customerId', async () => {
      mockBranchOk();
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(
        service.createIntake('tok', dto({ customerId: 'missing', customerType: undefined })),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyIntakeMember', () => {
    it('404 on unknown member code', async () => {
      mockBranchOk();
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.verifyIntakeMember('tok', 'MBR-999')).rejects.toThrow(NotFoundException);
    });

    it('returns member on exact match', async () => {
      mockBranchOk();
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c1',
        name: 'Budi',
        customerCode: 'MBR-001',
        isActive: true,
      });
      const res = await service.verifyIntakeMember('tok', 'MBR-001');
      expect(res).toEqual({ id: 'c1', name: 'Budi', customerCode: 'MBR-001' });
    });
  });
});
