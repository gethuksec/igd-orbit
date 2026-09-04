import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { JournalEntriesService } from '../finance/services/journal-entries.service';
import { ServiceOrdersService } from './service-orders.service';
import { SalesTransactionsService } from '../sales/sales-transactions.service';

describe('ServiceOrdersService.updateStatus — Smart Repair lifecycle (IGDERP-133)', () => {
  let service: ServiceOrdersService;
  let prisma: { serviceOrder: { findUnique: jest.Mock; update: jest.Mock }; serviceStatusHistory: { create: jest.Mock }; serviceType: { findUnique: jest.Mock }; $transaction: jest.Mock };

  const order = (status: string) => ({
    id: 'so-1',
    branchId: 'br-1',
    status,
    partsCost: { toString: () => '0' },
    laborCost: null,
    quotationNumber: null,
    qualityStatus: null,
    deliveredAt: null,
  });

  const tx = {
    serviceOrder: { update: jest.fn((args) => Promise.resolve(args)) },
    serviceStatusHistory: { create: jest.fn((args) => Promise.resolve(args)) },
    serviceOrderLayanan: { create: jest.fn((args) => Promise.resolve({ id: 'row-1', ...args.data })) },
  };

  const salesMock = {
    findByServiceOrderId: jest.fn(() => Promise.resolve(null)),
    createNoServiceFromParts: jest.fn((a: any) => Promise.resolve({ id: 'tx-1', ...a })),
  };

  beforeEach(async () => {
    prisma = {
      serviceOrder: { findUnique: jest.fn(), update: jest.fn() },
      serviceStatusHistory: { create: jest.fn() },
      serviceType: { findUnique: jest.fn() },
      $transaction: jest.fn((fn) => fn(tx)),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: JournalEntriesService, useValue: {} },
        {
          provide: SalesTransactionsService,
          useValue: salesMock,
        },
      ],
    }).compile();

    service = module.get(ServiceOrdersService);
    jest.clearAllMocks();
  });

  const run = async (fromStatus: string, dto: any, userId = 'user-1') => {
    prisma.serviceOrder.findUnique.mockResolvedValue(order(fromStatus));
    return service.updateStatus('so-1', dto, userId);
  };

  const runAddTime = async (fromStatus: string, dto: any, userId = 'user-1') => {
    prisma.serviceOrder.findUnique.mockResolvedValue({ ...order(fromStatus), slaDueDate: null });
    return service.addTime('so-1', dto, userId);
  };

  describe('addTime — IGDERP-134 (Tambah Waktu)', () => {
    it('rejects when status is not In Progress', async () => {
      await expect(runAddTime('ready', { notes: 'papan', newEstimatedAt: '2026-09-05T10:00:00Z' }))
        .rejects.toThrow(BadRequestException);
    });

    it('rejects when notes empty', async () => {
      await expect(runAddTime('in-progress', { notes: '   ', newEstimatedAt: '2026-09-05T10:00:00Z' }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws NotFound for missing order', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(null);
      await expect(service.addTime('so-x', { notes: 'x', newEstimatedAt: '2026-09-05T10:00:00Z' }, 'u'))
        .rejects.toThrow(NotFoundException);
    });

    it('extends promisedDate + slaDueDate and logs history', async () => {
      const at = '2026-09-05T10:00:00.000Z';
      prisma.serviceType.findUnique.mockResolvedValue({ id: 'st-1', name: 'Ganti LCD' });
      await runAddTime('in-progress', { serviceTypeId: 'st-1', notes: 'nggak jadi balik', newEstimatedAt: at });
      expect(tx.serviceOrder.update).toHaveBeenCalled();
      const updateArgs = tx.serviceOrder.update.mock.calls[0][0];
      expect(updateArgs.data.promisedDate).toEqual(new Date(at));
      expect(updateArgs.data.slaDueDate).toEqual(new Date(at));
      expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'in-progress',
            changedBy: 'user-1',
            notes: expect.stringContaining('Tambah waktu (Layanan: Ganti LCD)'),
          }),
        }),
      );
    });
  describe('IGDERP-138: POS No Service faktur at Done', () => {
    const sales = () => salesMock;

    it('creates No Service POS faktur when order reaches done with parts', async () => {
      const withParts = {
        ...order('ready'),
        serviceNumber: 'SRV-TEST-1',
        partsUsed: [
          {
            productId: 'prod-1',
            quantity: { toString: () => '2' },
            unitPrice: { toString: () => '50000' },
            serialNumber: null,
            notes: null,
            product: { name: 'Charger', sku: 'CHG-01' },
          },
        ],
      };
      prisma.serviceOrder.findUnique.mockResolvedValue(withParts);
      await service.updateStatus('so-1', { status: 'done' }, 'user-1');
      expect(sales().createNoServiceFromParts).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceOrderId: 'so-1',
          branchId: 'br-1',
          serviceNumber: 'SRV-TEST-1',
          parts: expect.arrayContaining([expect.objectContaining({ productId: 'prod-1' })]),
        }),
      );
    });

    it('does NOT create when order has no parts', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue({ ...order('ready'), partsUsed: [] });
      await service.updateStatus('so-1', { status: 'done' }, 'user-1');
      expect(sales().createNoServiceFromParts).not.toHaveBeenCalled();
    });

    it('does NOT create duplicate when POS faktur already exists (idempotent)', async () => {
      sales().findByServiceOrderId.mockResolvedValue({ id: 'tx-1' });
      prisma.serviceOrder.findUnique.mockResolvedValue({
        ...order('ready'),
        partsUsed: [
          { productId: 'prod-1', quantity: { toString: () => '1' }, unitPrice: { toString: () => '1000' }, product: { name: 'X' } },
        ],
      });
      await service.updateStatus('so-1', { status: 'done' }, 'user-1');
      expect(sales().createNoServiceFromParts).not.toHaveBeenCalled();
    });
  });
  });

  it('allows diagnosed -> in-progress (SR flow shortcut)', async () => {
    await run('diagnosed', { status: 'in-progress', notes: 'mulai kerjakan' });
    expect(tx.serviceOrder.update).toHaveBeenCalled();
    const data = tx.serviceOrder.update.mock.calls[0][0].data;
    expect(data.status).toBe('in-progress');
    expect(data.startedAt).toBeInstanceOf(Date);
    expect(tx.serviceStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'in-progress', previousStatus: 'diagnosed' }) }),
    );
  });

  it('allows in-progress -> ready and stamps readyAt + logs history', async () => {
    await run('in-progress', { status: 'ready', notes: 'selesai, part terpasang' });
    const data = tx.serviceOrder.update.mock.calls[0][0].data;
    expect(data.status).toBe('ready');
    expect(data.readyAt).toBeInstanceOf(Date);
  });

  it('allows ready -> done and stamps completedAt', async () => {
    await run('ready', { status: 'done', notes: 'unit diambil' });
    const data = tx.serviceOrder.update.mock.calls[0][0].data;
    expect(data.status).toBe('done');
    expect(data.completedAt).toBeInstanceOf(Date);
  });

  it('rejects ready -> done - INVALID: done is terminal', async () => {
    await expect(run('done', { status: 'done' })).rejects.toThrow(BadRequestException);
  });

  it('rejects skipping a step (pending -> ready)', async () => {
    await expect(run('pending', { status: 'ready' })).rejects.toThrow(BadRequestException);
  });

  it('cancel requires mandatory alasan (LOCK §5.2) — rejects empty reason', async () => {
    await expect(run('in-progress', { status: 'cancelled' })).rejects.toThrow(
      /Alasan pembatalan wajib/,
    );
    await expect(run('in-progress', { status: 'cancelled', notes: '   ' })).rejects.toThrow(
      /Alasan pembatalan wajib/,
    );
  });

  it('cancel allowed with reason from any non-final status (in-progress + ready)', async () => {
    await run('in-progress', { status: 'cancelled', notes: 'customer batal' });
    expect(tx.serviceOrder.update.mock.calls[0][0].data.cancelledAt).toBeInstanceOf(Date);

    tx.serviceOrder.update.mockClear();
    await run('ready', { status: 'cancelled', notes: 'customer tidak jadi ambil' });
    expect(tx.serviceOrder.update.mock.calls[0][0].data.status).toBe('cancelled');
  });

  it('preserves legacy transitions (regression): completed -> delivered', async () => {
    await run('completed', { status: 'delivered' });
    expect(tx.serviceOrder.update.mock.calls[0][0].data.status).toBe('delivered');
  });

  it('preserves legacy guard: QC must pass before completed (regression)', async () => {
    // qualityStatus null/undefined on fixture -> rejected
    await expect(run('qc', { status: 'completed', notes: '' })).rejects.toThrow(
      /QC must pass before completing/,
    );
    // with QC pass -> allowed
    prisma.serviceOrder.findUnique.mockResolvedValue({ ...order('qc'), qualityStatus: 'pass' });
    await expect(service.updateStatus('so-1', { status: 'completed', notes: '' }, 'u')).resolves.toBeTruthy();
  });

  it('throws NotFound when order missing', async () => {
    prisma.serviceOrder.findUnique.mockResolvedValue(null);
    await expect(service.updateStatus('nope', { status: 'ready' }, 'u')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('IGDERP-136: multi-layanan POS-like rows', () => {
    const layananOrder = (status: string, rows: any[] = []) => ({
      ...order(status),
      priority: 'normal',
      slaDueDate: null,
      layanan: rows,
    });

    it('adds layanan row + history at In Progress', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(layananOrder('in-progress'));
      prisma.serviceType.findUnique.mockResolvedValue({
        id: 'st-1',
        name: 'Flash',
        slaHours: { toString: () => '4' },
        basePrice: { toString: () => '50000' },
      });
      const row = await service.addLayanan('so-1', { serviceTypeId: 'st-1' }, 'u');
      expect(tx.serviceOrderLayanan.create).toHaveBeenCalled();
      expect(tx.serviceOrderLayanan.create.mock.calls[0][0].data).toMatchObject({
        serviceOrderId: 'so-1',
        serviceTypeId: 'st-1',
        name: 'Flash',
      });
      expect(tx.serviceStatusHistory.create).toHaveBeenCalled();
      expect(tx.serviceOrder.update).toHaveBeenCalled(); // sla_due_date push (prev null)
      expect(row.id).toBe('row-1');
    });

    it('rejects add layanan at Ready (in-progress only)', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(layananOrder('ready'));
      await expect(service.addLayanan('so-1', { serviceTypeId: 'st-1' }, 'u')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects duplicate layanan on same order', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(
        layananOrder('in-progress', [{ id: 'r1', serviceTypeId: 'st-1' }]),
      );
      await expect(service.addLayanan('so-1', { serviceTypeId: 'st-1' }, 'u')).rejects.toThrow(
        /sudah terpasang/,
      );
    });

    it('rejects unknown layanan (NotFound)', async () => {
      prisma.serviceOrder.findUnique.mockResolvedValue(layananOrder('in-progress'));
      prisma.serviceType.findUnique.mockResolvedValue(null);
      await expect(service.addLayanan('so-1', { serviceTypeId: 'st-x' }, 'u')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
