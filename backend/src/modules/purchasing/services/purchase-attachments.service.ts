import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { extname } from 'path';
import { PrismaService } from '../../../shared/services/prisma.service';

export const ATTACHMENT_ENTITY_TYPES = ['PURCHASE_ORDER', 'GOODS_RECEIPT'] as const;
export const ATTACHMENT_DOC_TYPES = ['INVOICE', 'DELIVERY_NOTE', 'ORDER_CONFIRM', 'OTHER'] as const;
export const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class PurchaseAttachmentsService {
  constructor(private prisma: PrismaService) {}

  private async assertEntity(entityType: string, entityId: string) {
    if (entityType === 'PURCHASE_ORDER') {
      const po = await this.prisma.purchaseOrder.findUnique({ where: { id: entityId } });
      if (!po) throw new NotFoundException('Purchase order not found');
    } else if (entityType === 'GOODS_RECEIPT') {
      const gr = await this.prisma.goodsReceipt.findUnique({ where: { id: entityId } });
      if (!gr) throw new NotFoundException('Goods receipt not found');
    } else {
      throw new BadRequestException('entityType must be PURCHASE_ORDER or GOODS_RECEIPT');
    }
  }

  async upload(
    entityType: string,
    entityId: string,
    documentType: string,
    files: UploadedFileLike[],
    userId: string,
  ) {
    if (!ATTACHMENT_ENTITY_TYPES.includes(entityType as any)) {
      throw new BadRequestException('entityType must be PURCHASE_ORDER or GOODS_RECEIPT');
    }
    if (!ATTACHMENT_DOC_TYPES.includes(documentType as any)) {
      throw new BadRequestException('documentType must be ' + ATTACHMENT_DOC_TYPES.join(', '));
    }
    if (!files || files.length === 0) {
      throw new BadRequestException('Minimal satu file wajib diunggah');
    }
    await this.assertEntity(entityType, entityId);

    const dir = join(process.cwd(), 'uploads', 'purchase-docs');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const saved: Array<{ fileName: string; filePath: string; fileSize: number; mimeType: string }> = [];
    for (const [i, f] of files.entries()) {
      if (!f.mimetype || !ALLOWED_MIMES.includes(f.mimetype)) {
        throw new BadRequestException('File wajib PDF/JPG/PNG: ' + (f.originalname || `file-${i + 1}`));
      }
      if (f.size > 10 * 1024 * 1024) {
        throw new BadRequestException('Maksimal 10MB per file: ' + (f.originalname || `file-${i + 1}`));
      }
      const ext = (extname(f.originalname || '').toLowerCase() || '.pdf').replace(/[^a-z0-9.]/g, '') || '.pdf';
      const name = `${entityId}-${Date.now()}-${i}${ext}`;
      writeFileSync(join(dir, name), f.buffer);
      saved.push({
        fileName: f.originalname || `file-${i + 1}`,
        filePath: `/uploads/purchase-docs/${name}`,
        fileSize: f.size,
        mimeType: f.mimetype,
      });
    }

    return this.prisma.purchaseAttachment.createMany({
      data: saved.map((s) => ({
        entityType,
        entityId,
        documentType,
        fileName: s.fileName,
        filePath: s.filePath,
        fileSize: s.fileSize,
        mimeType: s.mimeType,
        uploadedBy: userId,
      })),
    });
  }

  async list(entityType: string, entityId: string) {
    return this.prisma.purchaseAttachment.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(id: string, userId: string) {
    const row = await this.prisma.purchaseAttachment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Attachment not found');
    await this.prisma.purchaseAttachment.delete({ where: { id } });
    // Best-effort file cleanup (keep serving if the path is unknown)
    const filePath = join(process.cwd(), row.filePath.replace('/uploads/', 'uploads'));
    try {
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch {
      // ignore file cleanup errors — audit row is what matters
    }
    return { id, deleted: true, deletedBy: userId };
  }
}
