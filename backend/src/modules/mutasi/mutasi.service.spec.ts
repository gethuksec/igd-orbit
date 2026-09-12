import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../shared/services/prisma.service';
import { MutasiService } from './mutasi.service';
import { CreateMutasiDto } from './dto/create-mutasi.dto';

describe('MutasiService (IGDERP-140 — central ↔ outlet + outlet ↔ outlet)', () => {
  let service: MutasiService;
  let prisma: {
    warehouse: { findUnique: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
    product: { findMany: jest.Mock };
    user: { findMany: jest.Mock; findUnique: jest.Mock };
    productStock: { findMany: jest.Mock };
    stockTransfer: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tx: {
    stockTransfer: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    stockTransferItem: { update: jest.Mock };
    productStock: {
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    stockMovement: { create: jest.Mock };
  };

  const whA = {
    id: 'wh-a',
    code: 'KLS-GDG',
    name: 'Kalisat – Gudang',
    type: 'GOOD',
    scope: 'OUTLET',
    outletId: 'outlet-a',
    isActive: true,
  };
  const whA2 = {
    id: 'wh-a2',
    code: 'KLS-SRV',
    name: 'Kalisat – Gudang Service',
    type: 'GOOD',
    scope: 'OUTLET',
    outletId: 'outlet-a',
    isActive: true,
  };
  const whB = {
    id: 'wh-b',
    code: 'JBR-GDG',
    name: 'Jember – Gudang',
    type: 'GOOD',
    scope: 'OUTLET',
    outletId: 'outlet-b',
    isActive: true,
  };
  const centralBad = {
    id: '00000000-0000-4000-8000-000000000001',
    code: 'CENTRAL-BAD',
    name: 'Central Bad Stock',
    type: 'BAD',
    scope: 'SYSTEM',
    outletId: null,
    isActive: true,
  };
  const centralGood = {
    id: '00000000-0000-4000-8000-000000000002',
    code: 'CENTRAL-GOOD',
    name: 'Central Good Stock',
    type: 'GOOD',
    scope: 'SYSTEM',
    outletId: null,
    isActive: true,
  };
  const product = {
    id: 'prod-1',
    name: 'iPhone 15',
    sku: 'IP15-128',
    unitId: 'unit-1',
  };

  const stockRow = {
    id: 'ps-1',
    productId: 'prod-1',
    warehouseId: 'wh-a',
    quantityAvailable: new Decimal(10),
    quantityReserved: new Decimal(0),
    quantityDamaged: new Decimal(0),
  };

  const baseDto: CreateMutasiDto = {
    fromWarehouseId: 'wh-a',
    toWarehouseId: centralGood.id,
    notes: 'Kirim ke central',
    items: [{ productId: 'prod-1', quantity: 2 }],
  };

  const createdTransfer = {
    id: 'mutasi-1',
    transferNumber: 'MUT-20260906-123456',
    fromWarehouseId: 'wh-a',
    toWarehouseId: centralGood.id,
    fromBranchId: 'outlet-a',
    toBranchId: null,
    transferType: 'mutasi',
    status: 'completed',
    requestedBy: 'user-1',
    notes: 'Kirim ke central',
    createdAt: new Date('2026-09-06T10:00:00Z'),
    updatedAt: new Date('2026-09-06T10:00:00Z'),
    items: [
      {
        id: 'item-1',
        transferId: 'mutasi-1',
        productId: 'prod-1',
        productName: 'iPhone 15',
        productSku: 'IP15-128',
        quantityRequested: new Decimal(2),
        quantitySent: new Decimal(2),
        quantityReceived: new Decimal(2),
        notes: null,
        createdAt: new Date('2026-09-06T10:00:00Z'),
        updatedAt: new Date('2026-09-06T10:00:00Z'),
      },
    ],
    fromWarehouse: whA,
    toWarehouse: centralGood,
    fromBranch: { id: 'outlet-a', name: 'Kalisat', code: 'KLS' },
    toBranch: null,
  };

  beforeEach(async () => {
    tx = {
      stockTransfer: {
        create: jest.fn().mockImplementation(async (args: any) => ({
          id: 'mutasi-1',
          transferNumber: 'MUT-20260906-123456',
          ...args.data,
        })),
        findUnique: jest.fn().mockResolvedValue(createdTransfer),
        update: jest.fn().mockResolvedValue({ id: 'mutasi-1' }),
      },
      stockTransferItem: {
        update: jest.fn().mockResolvedValue({ id: 'item-1' }),
      },
      productStock: {
        findUnique: jest.fn().mockResolvedValue(stockRow),
        update: jest.fn().mockResolvedValue({ id: 'ps-1' }),
        create: jest.fn().mockResolvedValue({ id: 'ps-new' }),
      },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'sm-1' }) },
    };

    prisma = {
      warehouse: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          const map: Record<string, any> = {
            'wh-a': whA,
            'wh-a2': whA2,
            'wh-b': whB,
            [centralBad.id]: centralBad,
            [centralGood.id]: centralGood,
          };
          return map[where.id] || null;
        }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(centralBad),
      },
      product: { findMany: jest.fn().mockResolvedValue([product]) },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      productStock: { findMany: jest.fn().mockResolvedValue([]) },
      stockTransfer: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MutasiService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<MutasiService>(MutasiService);
  });

  describe('create — validation', () => {
    it('rejects empty items', async () => {
      await expect(
        service.create({ ...baseDto, items: [] }, 'user-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an unknown source warehouse', async () => {
      prisma.warehouse.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(centralGood);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects an inactive warehouse', async () => {
      prisma.warehouse.findUnique
        .mockResolvedValueOnce({ ...whA, isActive: false })
        .mockResolvedValueOnce(centralGood);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        /not a valid move endpoint/,
      );
    });

    it('rejects a BAD OUTLET warehouse (invalid endpoint)', async () => {
      prisma.warehouse.findUnique.mockResolvedValueOnce({
        ...whA,
        id: 'wh-bad-outlet',
        type: 'BAD',
        scope: 'OUTLET',
      });
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        /not a valid move endpoint/,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects identical source and destination', async () => {
      await expect(
        service.create(
          { ...baseDto, fromWarehouseId: 'wh-a', toWarehouseId: 'wh-a' },
          'user-1',
        ),
      ).rejects.toThrow('Source and destination warehouse must differ');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects central ↔ central (SYSTEM to SYSTEM)', async () => {
      await expect(
        service.create(
          {
            fromWarehouseId: centralGood.id,
            toWarehouseId: centralBad.id,
            items: [{ productId: 'prod-1', quantity: 1 }],
          },
          'user-1',
        ),
      ).rejects.toThrow('Central-to-central moves are not allowed');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects same-outlet moves (that is Transfer Stock, IGDERP-139)', async () => {
      await expect(
        service.create(
          { ...baseDto, fromWarehouseId: 'wh-a', toWarehouseId: 'wh-a2' },
          'user-1',
        ),
      ).rejects.toThrow(/Same-outlet moves are Transfer Stock/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rejects an unknown product', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await expect(service.create(baseDto, 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('create — success central ↔ outlet (IGDERP-173: pending, no stock move)', () => {
    it('outlet → central-good: pending doc, requested-only lines, branches nulled at central', async () => {
      const result = await service.create(baseDto, 'user-1');

      const createdData = tx.stockTransfer.create.mock.calls[0][0].data;
      expect(createdData.status).toBe('pending');
      expect(createdData.requestedBy).toBe('user-1');
      expect(createdData.transferType).toBe('mutasi');
      expect(createdData.fromWarehouseId).toBe('wh-a');
      expect(createdData.toWarehouseId).toBe(centralGood.id);
      expect(createdData.fromBranchId).toBe('outlet-a');
      expect(createdData.toBranchId).toBeNull();
      expect(createdData.items.create[0].quantityRequested.toString()).toBe('2');
      expect(createdData.items.create[0].quantitySent).toBeUndefined();
      expect(createdData.items.create[0].quantityReceived).toBeUndefined();

      // No stock moves at creation — source decrements at send()
      expect(tx.productStock.update).not.toHaveBeenCalled();
      expect(tx.productStock.create).not.toHaveBeenCalled();
      expect(tx.stockMovement.create).not.toHaveBeenCalled();

      expect(result.transferNumber).toBe('MUT-20260906-123456');
    });

    it('central-bad → outlet (return direction) is allowed', async () => {
      await service.create(
        {
          fromWarehouseId: centralBad.id,
          toWarehouseId: 'wh-a',
          items: [{ productId: 'prod-1', quantity: 3 }],
        },
        'user-1',
      );
      const createdData = tx.stockTransfer.create.mock.calls[0][0].data;
      expect(createdData.status).toBe('pending');
      expect(createdData.fromWarehouseId).toBe(centralBad.id);
      expect(createdData.toWarehouseId).toBe('wh-a');
      expect(createdData.fromBranchId).toBeNull();
      expect(createdData.toBranchId).toBe('outlet-a');
    });

    it('merges duplicate product lines', async () => {
      await service.create(
        {
          ...baseDto,
          items: [
            { productId: 'prod-1', quantity: 3 },
            { productId: 'prod-1', quantity: 4 },
          ],
        },
        'user-1',
      );
      const createdItems = tx.stockTransfer.create.mock.calls[0][0].data.items.create;
      expect(createdItems).toHaveLength(1);
      expect(Number(createdItems[0].quantityRequested)).toBe(7);
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });
  });

  describe('create — success outlet ↔ outlet (inter-outlet, absorbed from #78)', () => {
    it('allows outlet-a → outlet-b when outlets differ', async () => {
      await service.create(
        {
          fromWarehouseId: 'wh-a',
          toWarehouseId: 'wh-b',
          items: [{ productId: 'prod-1', quantity: 2 }],
        },
        'user-1',
      );
      const createdData = tx.stockTransfer.create.mock.calls[0][0].data;
      expect(createdData.fromWarehouseId).toBe('wh-a');
      expect(createdData.toWarehouseId).toBe('wh-b');
      expect(createdData.fromBranchId).toBe('outlet-a');
      expect(createdData.toBranchId).toBe('outlet-b');
    });
  });

  describe('send — pending → sent (IGDERP-173)', () => {
    const pendingDoc = (overrides: any = {}) => ({
      ...createdTransfer,
      status: 'pending',
      items: [
        {
          id: 'item-1',
          transferId: 'mutasi-1',
          productId: 'prod-1',
          productName: 'iPhone 15',
          productSku: 'IP15-128',
          quantityRequested: new Decimal(2),
          quantitySent: null,
          quantityReceived: null,
          notes: null,
        },
      ],
      ...overrides,
    });

    it('decrements source stock and stamps sent without touching destination', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(pendingDoc());

      await service.send('mutasi-1', {}, 'user-1');

      expect(tx.stockTransferItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { quantitySent: expect.anything() },
      });
      expect(Number(tx.stockTransferItem.update.mock.calls[0][0].data.quantitySent)).toBe(2);
      // source OUT only: one update + one OUT movement
      expect(tx.productStock.update).toHaveBeenCalledTimes(1);
      expect(Number(tx.productStock.update.mock.calls[0][0].data.quantityAvailable)).toBe(8);
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
      expect(tx.stockMovement.create.mock.calls[0][0].data.movementType).toBe('OUT');
      expect(tx.stockTransfer.update).toHaveBeenCalledWith({
        where: { id: 'mutasi-1' },
        data: { status: 'sent', sentBy: 'user-1', sentAt: expect.anything() },
      });
    });

    it('allows lowering quantitySent below requested', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(pendingDoc());

      await service.send('mutasi-1', { items: [{ itemId: 'item-1', quantitySent: 1 }] }, 'user-1');

      expect(Number(tx.stockTransferItem.update.mock.calls[0][0].data.quantitySent)).toBe(1);
      expect(Number(tx.productStock.update.mock.calls[0][0].data.quantityAvailable)).toBe(9);
    });

    it('rejects send on non-pending docs', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(pendingDoc({ status: 'sent' }));
      await expect(service.send('mutasi-1', {}, 'user-1')).rejects.toThrow(
        /Only pending documents can be sent/,
      );
    });

    it('rejects sent above requested and insufficient source stock', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(pendingDoc());
      await expect(
        service.send('mutasi-1', { items: [{ itemId: 'item-1', quantitySent: 5 }] }, 'user-1'),
      ).rejects.toThrow(/must be between 0 and 2/);

      tx.productStock.findUnique.mockResolvedValue({ ...stockRow, quantityAvailable: new Decimal(1) });
      await expect(service.send('mutasi-1', {}, 'user-1')).rejects.toThrow(/Insufficient stock/);
    });
  });

  describe('receive — sent → received (IGDERP-173)', () => {
    const sentDoc = (overrides: any = {}) => ({
      ...createdTransfer,
      status: 'sent',
      items: [
        {
          id: 'item-1',
          transferId: 'mutasi-1',
          productId: 'prod-1',
          productName: 'iPhone 15',
          productSku: 'IP15-128',
          quantityRequested: new Decimal(2),
          quantitySent: new Decimal(2),
          quantityReceived: null,
          notes: null,
        },
      ],
      ...overrides,
    });

    it('increments destination stock for a clean receive', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(sentDoc());
      tx.productStock.findUnique.mockResolvedValue(null); // no dest row → create

      await service.receive(
        'mutasi-1',
        { items: [{ itemId: 'item-1', quantityReceived: 2 }] },
        'user-1',
      );

      expect(tx.productStock.create).toHaveBeenCalledTimes(1);
      expect(Number(tx.productStock.create.mock.calls[0][0].data.quantityAvailable)).toBe(2);
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
      expect(tx.stockMovement.create.mock.calls[0][0].data.movementType).toBe('IN');
      // no damage doc
      expect(tx.stockTransfer.create).not.toHaveBeenCalled();
      expect(tx.stockTransfer.update).toHaveBeenCalledWith({
        where: { id: 'mutasi-1' },
        data: { status: 'received', receivedBy: 'user-1', receivedAt: expect.anything() },
      });
    });

    it('books damage to central-bad via auto mutasi when received + damage = sent', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(sentDoc());
      tx.productStock.findUnique.mockResolvedValue({ ...stockRow, warehouseId: 'wh-a' });

      await service.receive(
        'mutasi-1',
        {
          items: [
            {
              itemId: 'item-1',
              quantityReceived: 1,
              damageQuantity: 1,
              damagePhotoUrl: 'https://wa.me/photo-1',
              damageNotes: 'layar retak',
            },
          ],
        },
        'user-1',
      );

      // damage doc: destination GOOD → central BAD, completed
      const dmgData = tx.stockTransfer.create.mock.calls[0][0].data;
      expect(dmgData.transferType).toBe('mutasi');
      expect(dmgData.status).toBe('completed');
      expect(dmgData.fromWarehouseId).toBe(centralGood.id);
      expect(dmgData.toWarehouseId).toBe(centralBad.id);
      expect(dmgData.notes).toContain('https://wa.me/photo-1');
      // dest IN arrived(2), then damage leg OUT(dest,1) + IN(central-bad,1) → net +1 at dest
      const movements = tx.stockMovement.create.mock.calls.map((c: any) => c[0].data);
      expect(movements.filter((m: any) => m.movementType === 'IN')).toHaveLength(2);
      const outs = movements.filter((m: any) => m.movementType === 'OUT');
      expect(outs).toHaveLength(1);
      expect(outs[0].warehouseId).toBe(centralGood.id);
      expect(outs[0].notes).toContain('https://wa.me/photo-1');
    });

    it('rejects unexplained shortfall and non-sent docs', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(sentDoc());
      await expect(
        service.receive('mutasi-1', { items: [{ itemId: 'item-1', quantityReceived: 1 }] }, 'user-1'),
      ).rejects.toThrow(/must equal sent \(2\)/);

      prisma.stockTransfer.findUnique.mockResolvedValue(sentDoc({ status: 'pending' }));
      await expect(
        service.receive('mutasi-1', { items: [{ itemId: 'item-1', quantityReceived: 2 }] }, 'user-1'),
      ).rejects.toThrow(/Only sent documents can be received/);
    });
  });

  describe('cancel (IGDERP-173)', () => {
    it('cancels pending docs without touching stock', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue({ ...createdTransfer, status: 'pending' });

      await service.cancel('mutasi-1', 'user-1');

      expect(tx.productStock.update).not.toHaveBeenCalled();
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
      expect(tx.stockTransfer.update).toHaveBeenCalledWith({
        where: { id: 'mutasi-1' },
        data: { status: 'cancelled' },
      });
    });

    it('returns in-transit units to source when cancelling sent docs', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue({
        ...createdTransfer,
        status: 'sent',
        items: [
          {
            id: 'item-1',
            productId: 'prod-1',
            productName: 'iPhone 15',
            quantityRequested: new Decimal(2),
            quantitySent: new Decimal(2),
          },
        ],
      });

      await service.cancel('mutasi-1', 'user-1');

      expect(Number(tx.productStock.update.mock.calls[0][0].data.quantityAvailable)).toBe(12);
      expect(tx.stockMovement.create.mock.calls[0][0].data.movementType).toBe('IN');
    });

    it('rejects cancelling received docs', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue({ ...createdTransfer, status: 'received' });
      await expect(service.cancel('mutasi-1', 'user-1')).rejects.toThrow(
        /Only pending\/sent documents can be cancelled/,
      );
    });
  });

  describe('findAll / findById', () => {
    it('returns only mutasi-type documents with pagination meta', async () => {
      prisma.stockTransfer.findMany.mockResolvedValue([createdTransfer]);
      prisma.stockTransfer.count.mockResolvedValue(1);
      prisma.user.findMany.mockResolvedValue([{ id: 'user-1', fullName: 'Aizkan' }]);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(prisma.stockTransfer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { transferType: 'mutasi' } }),
      );
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(result.data[0].picName).toBe('Aizkan');
    });

    it('finds a mutasi document by id', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(createdTransfer);
      prisma.user.findUnique.mockResolvedValue({ id: 'user-1', fullName: 'Aizkan' });

      const result = await service.findById('mutasi-1');
      expect(result.transferNumber).toBe('MUT-20260906-123456');
      expect(result.picName).toBe('Aizkan');
    });

    it('rejects a non-mutasi document by id', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue({
        ...createdTransfer,
        transferType: 'transfer',
      });
      await expect(service.findById('transfer-1')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for an unknown id', async () => {
      prisma.stockTransfer.findUnique.mockResolvedValue(null);
      await expect(service.findById('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('supporting lists', () => {
    it('findWarehouses returns system + outlet GOOD warehouses with outlet info', async () => {
      prisma.warehouse.findMany.mockResolvedValue([centralGood, centralBad, whA]);
      const result = await service.findWarehouses();
      expect(prisma.warehouse.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isActive: true,
            OR: [{ scope: 'SYSTEM' }, { type: 'GOOD', scope: 'OUTLET' }],
          },
        }),
      );
      expect(result).toEqual([centralGood, centralBad, whA]);
    });

    it('searchProducts includes availableQuantity for the source warehouse', async () => {
      prisma.product.findMany.mockResolvedValue([
        { id: 'prod-1', name: 'iPhone 15', sku: 'IP15-128', unitId: null, unit: null },
      ]);
      prisma.productStock.findMany.mockResolvedValue([
        { productId: 'prod-1', quantityAvailable: new Decimal(7) },
      ]);

      const result = await service.searchProducts('iphone', 15, 'wh-a');
      expect(result[0].availableQuantity).toBe(7);
    });
  });
});
