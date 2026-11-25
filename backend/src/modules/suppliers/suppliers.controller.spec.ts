import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { CustomersService } from '../customers/customers.service';
import { SuppliersController } from './suppliers.controller';

jest.mock('exceljs', () => ({}), { virtual: true });

const dec = (n: number | string) => ({ toString: () => String(n) });

/**
 * IGDERP-312 — GET /suppliers enriches each row with live aggregates:
 * totalHutang (open PO totals), totalPiutang (completed return credit),
 * stokTerhutang (outstanding PO qty). Missing relations yield 0.
 */
describe('SuppliersController debt aggregates (IGDERP-312)', () => {
  let controller: SuppliersController;
  let prisma: {
    purchaseOrder: { groupBy: jest.Mock };
    purchaseReturn: { groupBy: jest.Mock };
    purchaseOrderItem: { findMany: jest.Mock };
  };
  const findAll = jest.fn();

  beforeEach(async () => {
    findAll.mockReset();
    prisma = {
      purchaseOrder: { groupBy: jest.fn().mockResolvedValue([]) },
      purchaseReturn: { groupBy: jest.fn().mockResolvedValue([]) },
      purchaseOrderItem: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SuppliersController],
      providers: [
        { provide: CustomersService, useValue: { findAll } },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    controller = module.get<SuppliersController>(SuppliersController);
  });

  const pageOf = (...ids: string[]) => ({
    data: ids.map((id) => ({ id, name: `Supplier ${id}` })),
    meta: { total: ids.length, page: 1, limit: 20, totalPages: 1 },
  });

  it('attaches hutang/piutang/stok aggregates per supplier', async () => {
    findAll.mockResolvedValue(pageOf('s1', 's2'));
    prisma.purchaseOrder.groupBy.mockResolvedValue([
      { supplierId: 's1', _sum: { totalAmount: dec(1500000) } },
    ]);
    prisma.purchaseReturn.groupBy.mockResolvedValue([
      { supplierId: 's2', _sum: { totalValue: dec(250000) } },
    ]);
    prisma.purchaseOrderItem.findMany.mockResolvedValue([
      {
        quantityOrdered: dec(10),
        quantityReceived: dec(4),
        purchaseOrder: { supplierId: 's1' },
      },
      {
        quantityOrdered: dec(5),
        quantityReceived: dec(5),
        purchaseOrder: { supplierId: 's1' },
      },
    ]);

    const result = await controller.findAll({} as any);

    expect(findAll).toHaveBeenCalledWith(
      expect.objectContaining({ 'filter[type]': 'wholesale' }),
    );
    expect(result.data).toEqual([
      {
        id: 's1',
        name: 'Supplier s1',
        totalHutang: 1500000,
        totalPiutang: 0,
        stokTerhutang: 6,
      },
      {
        id: 's2',
        name: 'Supplier s2',
        totalHutang: 0,
        totalPiutang: 250000,
        stokTerhutang: 0,
      },
    ]);
  });

  it('defaults to 0 and skips aggregation queries on an empty page', async () => {
    findAll.mockResolvedValue(pageOf());

    const result = await controller.findAll({} as any);

    expect(result.data).toEqual([]);
    expect(prisma.purchaseOrder.groupBy).not.toHaveBeenCalled();
    expect(prisma.purchaseReturn.groupBy).not.toHaveBeenCalled();
    expect(prisma.purchaseOrderItem.findMany).not.toHaveBeenCalled();
  });

  it('ignores over-received items when summing stok terhutang', async () => {
    findAll.mockResolvedValue(pageOf('s1'));
    prisma.purchaseOrderItem.findMany.mockResolvedValue([
      {
        quantityOrdered: dec(3),
        quantityReceived: dec(5),
        purchaseOrder: { supplierId: 's1' },
      },
    ]);

    const result = await controller.findAll({} as any);

    expect(result.data[0].stokTerhutang).toBe(0);
  });
});
