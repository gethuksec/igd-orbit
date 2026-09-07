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
      customer: { findUnique: jest.fn() },
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
      prisma.branch.findUnique.mockResolvedValue(branch);
      prisma.branch.update.mockImplementation(async ({ data }: any) => ({ ...branch, ...data }));
      const res = await service.rotateIntakeToken('branch-1');
      expect(res.intakeToken).toMatch(/^[0-9a-f]{48}$/);
      expect(res.branchId).toBe('branch-1');
    });

    it('404 on unknown branch', async () => {
      prisma.branch.findUnique.mockResolvedValue(null);
      await expect(service.rotateIntakeToken('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listIntakeLinks', () => {
    it('returns only active outlets with their tokens', async () => {
      prisma.branch.findMany.mockResolvedValue([
        { id: 'b1', code: 'BR-001', name: 'Jember Pusat', intakeToken: 'tok1' },
        { id: 'b2', code: 'BR-002', name: 'Kalisat', intakeToken: null },
      ]);
      const res = await service.listIntakeLinks();
      expect(prisma.branch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
      expect(res).toEqual([
        { branchId: 'b1', branchCode: 'BR-001', branchName: 'Jember Pusat', intakeToken: 'tok1' },
        { branchId: 'b2', branchCode: 'BR-002', branchName: 'Kalisat', intakeToken: null },
      ]);
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
