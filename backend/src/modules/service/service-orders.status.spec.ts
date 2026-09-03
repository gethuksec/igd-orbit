import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../shared/services/prisma.service';
import { JournalEntriesService } from '../finance/services/journal-entries.service';
import { ServiceOrdersService } from './service-orders.service';

describe('ServiceOrdersService.updateStatus — Smart Repair lifecycle (IGDERP-133)', () => {
  let service: ServiceOrdersService;
  let prisma: { serviceOrder: { findUnique: jest.Mock; update: jest.Mock }; serviceStatusHistory: { create: jest.Mock }; $transaction: jest.Mock };

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
  };

  beforeEach(async () => {
    prisma = {
      serviceOrder: { findUnique: jest.fn(), update: jest.fn() },
      serviceStatusHistory: { create: jest.fn() },
      $transaction: jest.fn((fn) => fn(tx)),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: JournalEntriesService, useValue: {} },
      ],
    }).compile();

    service = module.get(ServiceOrdersService);
    jest.clearAllMocks();
  });

  const run = async (fromStatus: string, dto: any, userId = 'user-1') => {
    prisma.serviceOrder.findUnique.mockResolvedValue(order(fromStatus));
    return service.updateStatus('so-1', dto, userId);
  };

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
});
