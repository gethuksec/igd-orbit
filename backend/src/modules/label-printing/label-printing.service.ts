import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/services/prisma.service';
import { MarkLabelsPrintedDto, UpdateLabelSettingDto } from './dto/label-printing.dto';

/** Built-in template used until a profile row is saved (client label format still pending). */
export const DEFAULT_LABEL_SETTINGS = {
  name: 'Default',
  labelWidthMm: 40,
  labelHeightMm: 30,
  columns: 3,
  symbology: 'BARCODE',
  paperType: 'THERMAL',
  showPrintedName: true,
  showPrice: true,
  showSku: true,
  autoPrint: false,
};

type GrLineForLabels = {
  productId: string;
  quantityAccepted: Prisma.Decimal | number;
  batchNumber?: string | null;
  serialNumber?: string | null;
  expiryDate?: Date | null;
  product: {
    barcode: string | null;
    sku: string;
    name: string;
    printedName: string | null;
    sellingPrice: Prisma.Decimal | number;
  };
};

/**
 * S5 (fc7b9d65): barcode/label printing.
 *
 * Scaffold scope: approving a goods receipt queues one print job per line
 * (copies = accepted qty). The FE renders the print sheet from these jobs and
 * marks them printed; true silent auto-print will hook a print agent later
 * (`autoPrint` flag is stored but the queue is always created).
 */
@Injectable()
export class LabelPrintingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Generate job number: LBL-YYYYMMDD-XXXXXX. */
  private generateJobNumber(offset = 0): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = (Math.floor(Math.random() * 1000000) + offset) % 1000000;
    return `LBL-${dateStr}-${random.toString().padStart(6, '0')}`;
  }

  /** Effective settings: the persisted active profile, or built-in defaults. */
  async getSettings() {
    const row = await this.prisma.labelSetting.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!row) {
      return { id: null, configured: false, ...DEFAULT_LABEL_SETTINGS };
    }
    return {
      id: row.id,
      configured: true,
      name: row.name,
      labelWidthMm: Number(row.labelWidthMm),
      labelHeightMm: Number(row.labelHeightMm),
      columns: row.columns,
      symbology: row.symbology,
      paperType: row.paperType,
      showPrintedName: row.showPrintedName,
      showPrice: row.showPrice,
      showSku: row.showSku,
      autoPrint: row.autoPrint,
      updatedAt: row.updatedAt,
    };
  }

  /** Upsert the active settings profile (single active row for the scaffold). */
  async updateSettings(dto: UpdateLabelSettingDto, userId: string) {
    const existing = await this.prisma.labelSetting.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!existing) {
      await this.prisma.labelSetting.create({
        data: { ...DEFAULT_LABEL_SETTINGS, ...dto, updatedBy: userId },
      });
    } else {
      await this.prisma.labelSetting.update({
        where: { id: existing.id },
        data: { ...dto, updatedBy: userId },
      });
    }
    return this.getSettings();
  }

  /**
   * Pure builder (unit-tested): one queue row per GR line with accepted qty > 0.
   * copies = ceil(accepted qty) so a partial unit still gets a label.
   * Payload is a snapshot so labels survive later product edits.
   */
  buildJobsForReceipt(
    gr: { id: string; grNumber: string },
    items: GrLineForLabels[],
  ): Prisma.LabelPrintJobCreateManyInput[] {
    const rows: Prisma.LabelPrintJobCreateManyInput[] = [];
    for (const item of items) {
      const copies = Math.ceil(Number(item.quantityAccepted));
      if (copies <= 0) continue;
      rows.push({
        jobNumber: this.generateJobNumber(rows.length),
        goodsReceiptId: gr.id,
        productId: item.productId,
        copies,
        payload: {
          barcode: item.product.barcode || item.product.sku,
          sku: item.product.sku,
          name: item.product.name,
          printedName: item.product.printedName || item.product.name,
          price: Number(item.product.sellingPrice),
          grNumber: gr.grNumber,
          batchNumber: item.batchNumber ?? null,
          serialNumber: item.serialNumber ?? null,
          expiryDate: item.expiryDate ?? null,
        },
      });
    }
    return rows;
  }

  /** Queue rows (default: everything except cancelled), newest first. */
  async listJobs(params: { status?: string; goodsReceiptId?: string; ids?: string }) {
    const where: Prisma.LabelPrintJobWhereInput = {};
    where.status = params.status ? params.status : { not: 'cancelled' };
    if (params.goodsReceiptId) where.goodsReceiptId = params.goodsReceiptId;
    if (params.ids) {
      const ids = params.ids.split(',').map((s) => s.trim()).filter(Boolean);
      where.id = { in: ids };
    }
    const jobs = await this.prisma.labelPrintJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        product: { select: { id: true, name: true, sku: true, printedName: true, barcode: true } },
        goodsReceipt: { select: { id: true, grNumber: true } },
        printedByUser: { select: { id: true, fullName: true } },
      },
    });
    const pendingCount = await this.prisma.labelPrintJob.count({ where: { status: 'pending' } });
    return { data: jobs, total: jobs.length, pendingCount };
  }

  /** Mark queued (pending) jobs as printed after the print sheet runs. */
  async markPrinted(dto: MarkLabelsPrintedDto, userId: string) {
    const result = await this.prisma.labelPrintJob.updateMany({
      where: { id: { in: dto.ids }, status: 'pending' },
      data: { status: 'printed', printedAt: new Date(), printedBy: userId },
    });
    return { updated: result.count };
  }
}
