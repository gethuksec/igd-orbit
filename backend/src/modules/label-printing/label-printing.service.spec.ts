import { Decimal } from '@prisma/client/runtime/library';
import { LabelPrintingService } from './label-printing.service';

/**
 * S5 (fc7b9d65): label print queue unit tests — payload generation + settings persist.
 */
describe('LabelPrintingService (S5)', () => {
  let service: LabelPrintingService;
  const prisma: any = {
    labelSetting: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    labelPrintJob: { findMany: jest.fn(), count: jest.fn(), updateMany: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LabelPrintingService(prisma);
  });

  // ---------------------------------------------------------------- queue builder

  describe('buildJobsForReceipt', () => {
    const gr = { id: 'gr-1', grNumber: 'GR-20260912-000001' };
    const product = {
      barcode: '8991234567890',
      sku: 'ACC-003',
      name: 'Charger Fast Charging 25W Samsung',
      printedName: 'Charger 25W',
      sellingPrice: new Decimal(120000),
    };

    it('creates one job per line with accepted qty > 0, copies = accepted qty', () => {
      const rows = service.buildJobsForReceipt(gr, [
        { productId: 'p-1', quantityAccepted: new Decimal(3), product },
        { productId: 'p-2', quantityAccepted: new Decimal(0), product: { ...product, sku: 'X-1' } },
        { productId: 'p-3', quantityAccepted: new Decimal(2), product: { ...product, sku: 'X-2' } },
      ]);

      expect(rows).toHaveLength(2);
      expect(rows[0].copies).toBe(3);
      expect(rows[0].goodsReceiptId).toBe('gr-1');
      expect(rows[0].productId).toBe('p-1');
      expect(rows[1].copies).toBe(2);
      expect(rows[1].productId).toBe('p-3');
    });

    it('snapshots the label payload with barcode/printedName/price and GR provenance', () => {
      const rows = service.buildJobsForReceipt(gr, [
        {
          productId: 'p-1',
          quantityAccepted: new Decimal(1),
          batchNumber: 'B-77',
          expiryDate: new Date('2027-01-31'),
          product,
        },
      ]);

      const payload: any = rows[0].payload;
      expect(payload.barcode).toBe('8991234567890');
      expect(payload.sku).toBe('ACC-003');
      expect(payload.printedName).toBe('Charger 25W');
      expect(payload.price).toBe(120000);
      expect(payload.grNumber).toBe('GR-20260912-000001');
      expect(payload.batchNumber).toBe('B-77');
      expect(payload.expiryDate).toEqual(new Date('2027-01-31'));
    });

    it('falls back to sku when barcode is missing, and to name when printedName is null', () => {
      const rows = service.buildJobsForReceipt(gr, [
        {
          productId: 'p-1',
          quantityAccepted: new Decimal(1),
          product: { ...product, barcode: null, printedName: null },
        },
      ]);
      const payload: any = rows[0].payload;
      expect(payload.barcode).toBe('ACC-003');
      expect(payload.printedName).toBe('Charger Fast Charging 25W Samsung');
    });

    it('uses one job number per row (LBL- prefix, unique)', () => {
      const rows = service.buildJobsForReceipt(gr, [
        { productId: 'p-1', quantityAccepted: new Decimal(1), product },
        { productId: 'p-2', quantityAccepted: new Decimal(1), product: { ...product, sku: 'X-1' } },
        { productId: 'p-3', quantityAccepted: new Decimal(1), product: { ...product, sku: 'X-2' } },
      ]);
      const jobNumbers = rows.map((r) => r.jobNumber);
      expect(jobNumbers.every((n) => n.startsWith('LBL-'))).toBe(true);
      expect(new Set(jobNumbers).size).toBe(3);
    });

    it('rounds partial units up so a fractional qty still gets a label', () => {
      const rows = service.buildJobsForReceipt(gr, [
        { productId: 'p-1', quantityAccepted: new Decimal('2.5'), product },
      ]);
      expect(rows[0].copies).toBe(3);
    });
  });

  // ---------------------------------------------------------------- settings

  describe('settings', () => {
    it('returns built-in defaults when no profile is configured', async () => {
      prisma.labelSetting.findFirst.mockResolvedValue(null);
      const settings = await service.getSettings();
      expect(settings.configured).toBe(false);
      expect(settings.id).toBeNull();
      expect(settings.labelWidthMm).toBe(40);
      expect(settings.labelHeightMm).toBe(30);
      expect(settings.symbology).toBe('BARCODE');
      expect(settings.paperType).toBe('THERMAL');
    });

    it('returns the persisted active profile with numeric dimensions', async () => {
      prisma.labelSetting.findFirst.mockResolvedValue({
        id: 'ls-1',
        name: 'Default',
        isActive: true,
        autoPrint: false,
        labelWidthMm: new Decimal('50.0'),
        labelHeightMm: new Decimal('25.0'),
        columns: 4,
        symbology: 'QR',
        paperType: 'A4',
        showPrintedName: true,
        showPrice: false,
        showSku: true,
        updatedAt: new Date('2026-09-12'),
      });
      const settings = await service.getSettings();
      expect(settings.configured).toBe(true);
      expect(settings.labelWidthMm).toBe(50);
      expect(settings.labelHeightMm).toBe(25);
      expect(settings.symbology).toBe('QR');
      expect(settings.showPrice).toBe(false);
    });

    it('creates the profile on first save (defaults merged with overrides)', async () => {
      prisma.labelSetting.findFirst.mockResolvedValue(null);
      prisma.labelSetting.create.mockResolvedValue({});
      await service.updateSettings({ labelWidthMm: 50, symbology: 'QR' }, 'user-1');
      const data = prisma.labelSetting.create.mock.calls[0][0].data;
      expect(data.labelWidthMm).toBe(50);
      expect(data.symbology).toBe('QR');
      expect(data.columns).toBe(3); // default kept
      expect(data.updatedBy).toBe('user-1');
    });

    it('updates the existing active profile', async () => {
      prisma.labelSetting.findFirst.mockResolvedValue({ id: 'ls-1' });
      prisma.labelSetting.update.mockResolvedValue({});
      await service.updateSettings({ paperType: 'A4' }, 'user-2');
      expect(prisma.labelSetting.update.mock.calls[0][0].where).toEqual({ id: 'ls-1' });
      expect(prisma.labelSetting.update.mock.calls[0][0].data.paperType).toBe('A4');
      expect(prisma.labelSetting.update.mock.calls[0][0].data.updatedBy).toBe('user-2');
    });
  });

  // ---------------------------------------------------------------- queue + printing

  describe('listJobs / markPrinted', () => {
    it('filters queued jobs by non-cancelled by default and reports pendingCount', async () => {
      prisma.labelPrintJob.findMany.mockResolvedValue([]);
      prisma.labelPrintJob.count.mockResolvedValue(5);
      const res = await service.listJobs({});
      expect(prisma.labelPrintJob.findMany.mock.calls[0][0].where.status).toEqual({ not: 'cancelled' });
      expect(res.pendingCount).toBe(5);
    });

    it('parses the ids csv filter (print sheet selection)', async () => {
      prisma.labelPrintJob.findMany.mockResolvedValue([]);
      prisma.labelPrintJob.count.mockResolvedValue(0);
      await service.listJobs({ ids: 'a, b ,c' });
      expect(prisma.labelPrintJob.findMany.mock.calls[0][0].where.id).toEqual({ in: ['a', 'b', 'c'] });
    });

    it('marks only pending jobs as printed, recording the actor', async () => {
      prisma.labelPrintJob.updateMany.mockResolvedValue({ count: 2 });
      const res = await service.markPrinted({ ids: ['j1', 'j2'] }, 'user-9');
      const call = prisma.labelPrintJob.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: { in: ['j1', 'j2'] }, status: 'pending' });
      expect(call.data.status).toBe('printed');
      expect(call.data.printedBy).toBe('user-9');
      expect(call.data.printedAt).toBeInstanceOf(Date);
      expect(res.updated).toBe(2);
    });
  });
});
