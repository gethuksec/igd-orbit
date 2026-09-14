import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateStockOutDto, StockOutItemDto } from './dto/create-stock-out.dto';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import {
  buildImportTemplate,
  buildSnapshotWorkbook,
  parseImportBuffer,
  parseImportNumber,
  RawImportRow,
} from '../../shared/utils/stock-import-template';
import { Decimal } from '@prisma/client/runtime/library';
import type { ImportPreviewRow } from '../stock-in/stock-in.service';

interface MergedLine {
  productId: string;
  quantity: number;
  unitId?: string;
  stockValue?: number;
}

@Injectable()
export class StockOutService {
  constructor(private prisma: PrismaService) {}

  private generateDocumentNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `SOUT-${dateStr}-${random}`;
  }

  /**
   * Merge duplicate product lines: sum quantity, keep the first explicit
   * stockValue/unitId for the line.
   */
  private mergeItems(items: StockOutItemDto[]): MergedLine[] {
    const merged = new Map<string, MergedLine>();
    for (const item of items) {
      const existing = merged.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
        if (existing.stockValue === undefined && item.stockValue !== undefined) {
          existing.stockValue = item.stockValue;
        }
        if (!existing.unitId && item.unitId) {
          existing.unitId = item.unitId;
        }
      } else {
        merged.set(item.productId, {
          productId: item.productId,
          quantity: item.quantity,
          unitId: item.unitId,
          stockValue: item.stockValue,
        });
      }
    }
    return Array.from(merged.values());
  }

  /**
   * Create a Stock Out document atomically:
   * - StockOut + StockOutItem rows
   * - ProductStock decrement by warehouse (must exist with enough quantity)
   * - StockMovement OUT rows (referenceType STOCK_OUT, negative quantityChange)
   * No GL / cash / sales / purchase / finance transaction is created.
   */
  async create(dto: CreateStockOutDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one product line is required');
    }

    const lines = this.mergeItems(dto.items);

    // ── Warehouse: outlet-owned GOOD warehouse OR the system-scoped Central Bad Stock warehouse ──
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: dto.warehouseId },
    });
    if (!warehouse) {
      throw new NotFoundException('Warehouse not found');
    }
    if (!warehouse.isActive) {
      throw new BadRequestException('Cannot remove stock from an inactive warehouse');
    }

    let outletId: string | null = null;
    const isOutletGood = warehouse.type === 'GOOD' && warehouse.scope === 'OUTLET';
    const isSystemBad = warehouse.type === 'BAD' && warehouse.scope === 'SYSTEM';

    if (isOutletGood) {
      if (!dto.outletId) {
        throw new BadRequestException('Outlet is required for an outlet warehouse');
      }
      const outlet = await this.prisma.branch.findUnique({
        where: { id: dto.outletId },
      });
      if (!outlet) {
        throw new NotFoundException('Outlet not found');
      }
      if (warehouse.outletId !== dto.outletId) {
        throw new BadRequestException(
          'Selected warehouse must belong to the selected outlet',
        );
      }
      outletId = warehouse.outletId;
    } else if (!isSystemBad) {
      throw new BadRequestException(
        'Selected warehouse must be an outlet GOOD warehouse or the Central Bad Stock warehouse',
      );
    }

    // ── Products + stock value defaults (Product.minSellingPrice) ──
    const productIds = lines.map((l) => l.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { unit: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const unitIds = lines
      .map((l) => l.unitId || productMap.get(l.productId)?.unitId)
      .filter((id): id is string => !!id);
    const units = unitIds.length
      ? await this.prisma.unit.findMany({ where: { id: { in: unitIds } } })
      : [];
    const unitMap = new Map(units.map((u) => [u.id, u]));

    const resolvedLines = lines.map((line) => {
      const product = productMap.get(line.productId);
      if (!product) {
        throw new NotFoundException(`Product ${line.productId} not found`);
      }
      const stockValue =
        line.stockValue !== undefined
          ? line.stockValue
          : product.minSellingPrice !== null && product.minSellingPrice !== undefined
            ? Number(product.minSellingPrice)
            : Number(product.sellingPrice);
      const unitId = line.unitId || product.unitId || undefined;
      const unitName = unitId ? unitMap.get(unitId)?.name || null : null;
      return {
        productId: line.productId,
        productName: product.name,
        productSku: product.sku,
        quantity: line.quantity,
        unitId,
        unitName,
        stockValue,
      };
    });

    const documentDate = dto.date ? new Date(dto.date) : new Date();
    const documentNumber = this.generateDocumentNumber();

    return await this.prisma.$transaction(async (tx) => {
      const stockOut = await tx.stockOut.create({
        data: {
          documentNumber,
          outletId,
          warehouseId: dto.warehouseId,
          documentDate,
          reason: dto.reason,
          createdBy: userId,
          items: {
            create: resolvedLines.map((line) => {
              const lineTotal = new Decimal(line.quantity)
                .mul(new Decimal(line.stockValue))
                .toDecimalPlaces(2);
              return {
                productId: line.productId,
                productName: line.productName,
                productSku: line.productSku,
                quantity: new Decimal(line.quantity),
                unitId: line.unitId,
                unitName: line.unitName,
                stockValue: new Decimal(line.stockValue),
                lineTotal,
              };
            }),
          },
        },
        include: { items: true },
      });

      // Per-line stock decrement + StockMovement OUT rows
      for (const line of resolvedLines) {
        const stock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: warehouse.id,
            },
          },
        });

        const quantityBefore = stock ? Number(stock.quantityAvailable) : 0;
        if (!stock || quantityBefore < line.quantity) {
          throw new BadRequestException(
            `Insufficient stock for "${line.productName}" (available: ${quantityBefore}, requested: ${line.quantity})`,
          );
        }
        const quantityAfter = quantityBefore - line.quantity;

        await tx.productStock.update({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: warehouse.id,
            },
          },
          data: {
            quantityAvailable: new Decimal(quantityAfter),
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            warehouseId: warehouse.id,
            branchId: outletId,
            movementType: 'OUT',
            referenceType: 'STOCK_OUT',
            referenceId: stockOut.id,
            quantityChange: new Decimal(-line.quantity),
            quantityBefore: new Decimal(quantityBefore),
            quantityAfter: new Decimal(quantityAfter),
            notes: `Stock Out: ${documentNumber} - ${dto.reason}`,
            createdBy: userId,
          },
        });
      }

      const totalValue = resolvedLines.reduce(
        (sum, line) => sum.add(new Decimal(line.quantity).mul(new Decimal(line.stockValue))),
        new Decimal(0),
      );

      return tx.stockOut.update({
        where: { id: stockOut.id },
        data: { totalValue: totalValue.toDecimalPlaces(2) },
        include: {
          items: { include: { product: true } },
          outlet: true,
          warehouse: true,
        },
      });
    }).then((doc) => this.serialize(doc));
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    outletId?: string;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.outletId) where.outletId = query.outletId;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.startDate || query.endDate) {
      where.documentDate = {};
      if (query.startDate) where.documentDate.gte = new Date(query.startDate);
      if (query.endDate) where.documentDate.lte = new Date(query.endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.stockOut.findMany({
        where,
        include: {
          items: { include: { product: true } },
          outlet: true,
          warehouse: true,
        },
        orderBy: { documentDate: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockOut.count({ where }),
    ]);

    return {
      data: data.map((doc) => this.serialize(doc)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const doc = await this.prisma.stockOut.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        outlet: true,
        warehouse: true,
      },
    });
    if (!doc) {
      throw new NotFoundException('Stock Out document not found');
    }
    return this.serialize(doc);
  }

  private serialize(doc: any) {
    return {
      ...doc,
      totalValue: Number(doc.totalValue),
      items: doc.items.map((item: any) => ({
        ...item,
        quantity: Number(item.quantity),
        stockValue: Number(item.stockValue),
        lineTotal: Number(item.lineTotal),
      })),
    };
  }

  // ── Supporting lists for the Stock Out form ──

  /**
   * Source warehouse candidates: active GOOD OUTLET warehouses (optionally
   * scoped to an outlet) PLUS the single system-scoped Central Bad Stock
   * warehouse (which does not require an outlet).
   */
  async findSourceWarehouses(outletId?: string) {
    const goodsWhere: any = {
      type: 'GOOD',
      scope: 'OUTLET',
      isActive: true,
    };
    if (outletId) goodsWhere.outletId = outletId;

    const [goods, systemBad] = await Promise.all([
      this.prisma.warehouse.findMany({
        where: goodsWhere,
        select: { id: true, code: true, name: true, type: true, scope: true, outletId: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.warehouse.findMany({
        where: { type: 'BAD', scope: 'SYSTEM', isActive: true },
        select: { id: true, code: true, name: true, type: true, scope: true, outletId: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    return [...goods, ...systemBad];
  }

  /**
   * Product search for the line picker (includes pricing defaults for lines).
   * When warehouseId is provided, each result also carries the available
   * quantity in that warehouse so the picker can show remaining stock.
   */
  async searchProducts(q?: string, limit = 15, warehouseId?: string) {
    const where: any = {
      isActive: true,
      deletedAt: null,
    };
    if (q && q.trim().length > 0) {
      where.OR = [
        { name: { contains: q.trim(), mode: 'insensitive' } },
        { sku: { contains: q.trim(), mode: 'insensitive' } },
        { barcode: { contains: q.trim(), mode: 'insensitive' } },
      ];
    }
    const products = await this.prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        sellingPrice: true,
        minSellingPrice: true,
        memberPricing: true,
        unitId: true,
        unit: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
      take: Math.min(limit, 50),
    });

    let stockMap = new Map<string, number>();
    if (warehouseId) {
      const stocks = await this.prisma.productStock.findMany({
        where: {
          productId: { in: products.map((p) => p.id) },
          warehouseId,
        },
        select: { productId: true, quantityAvailable: true },
      });
      stockMap = new Map(
        stocks.map((s) => [s.productId, Number(s.quantityAvailable)]),
      );
    }

    return products.map((p) => ({
      ...p,
      sellingPrice: Number(p.sellingPrice),
      minSellingPrice: p.minSellingPrice !== null ? Number(p.minSellingPrice) : null,
      availableQuantity: stockMap.get(p.id) ?? 0,
    }));
  }

  // ═══════════════════════════════════════════════════════════
  // IGDERP-97 (I4) — Excel import: template / preview / confirm / export
  // Template === export columns (round-trip). Files are never stored.
  // ═══════════════════════════════════════════════════════════

  async buildImportTemplate(): Promise<Buffer> {
    return buildImportTemplate();
  }

  /**
   * Parse + validate an uploaded workbook. READ-ONLY. Duplicate SKUs are
   * merged (quantities summed) BEFORE the availability check, so the
   * over-qty flag reflects the true total per product.
   */
  async previewImport(buffer: Buffer, warehouseId: string) {
    let raw: RawImportRow[];
    try {
      raw = await parseImportBuffer(buffer);
    } catch (e: any) {
      throw new BadRequestException(e.message || 'File Excel tidak valid');
    }

    const skus = [...new Set(raw.filter((r) => r.sku).map((r) => r.sku!))];
    const barcodes = [...new Set(raw.filter((r) => r.barcode).map((r) => r.barcode!))];
    const ors: any[] = [];
    if (skus.length) ors.push({ sku: { in: skus } });
    if (barcodes.length) ors.push({ barcode: { in: barcodes } });
    const products = ors.length
      ? await this.prisma.product.findMany({ where: { OR: ors }, include: { unit: true } })
      : [];
    const bySku = new Map(products.map((p) => [p.sku.toLowerCase(), p]));
    const byBarcode = new Map(
      products.filter((p) => p.barcode).map((p) => [(p.barcode as string).toLowerCase(), p]),
    );

    const groups = new Map<string, { product: any | null; raws: RawImportRow[] }>();
    for (const r of raw) {
      const product =
        (r.sku && bySku.get(r.sku.toLowerCase())) ||
        (r.barcode && byBarcode.get(r.barcode.toLowerCase())) ||
        null;
      const key = product ? product.id : `unknown:${(r.sku || r.barcode || '').toLowerCase()}`;
      if (!groups.has(key)) groups.set(key, { product, raws: [] });
      groups.get(key)!.raws.push(r);
    }

    const knownIds = [...groups.values()].filter((g) => g.product).map((g) => g.product.id);
    const avail = new Map<string, number>();
    if (knownIds.length) {
      const stocks = await this.prisma.productStock.findMany({
        where: { productId: { in: knownIds }, warehouseId },
        select: { productId: true, quantityAvailable: true },
      });
      for (const s of stocks) avail.set(s.productId, Number(s.quantityAvailable));
    }

    const rows: ImportPreviewRow[] = [];
    for (const { product, raws } of groups.values()) {
      const rowNumbers = raws.map((r) => r.rowNumber);
      const errors: string[] = [];
      if (!product) {
        const id = raws[0].sku || raws[0].barcode || '(kosong)';
        errors.push(`Produk tidak ditemukan (SKU/Barcode: ${id})`);
      }
      let quantity: number | null = null;
      let qtyOk = true;
      let total = 0;
      for (const r of raws) {
        const q = parseImportNumber(r.quantityRaw);
        if (q === null || !(q > 0)) {
          qtyOk = false;
          errors.push(`Baris ${r.rowNumber}: Qty tidak valid`);
        } else {
          total += q;
        }
      }
      if (qtyOk) quantity = total;
      let stockValue: number | null | undefined;
      for (const r of raws) {
        if (r.stockValueRaw === '' || r.stockValueRaw === undefined) continue;
        const v = parseImportNumber(r.stockValueRaw);
        if (v === null || v < 0) {
          errors.push(`Baris ${r.rowNumber}: Nilai Stok tidak valid`);
        } else if (stockValue === undefined || stockValue === null) {
          stockValue = v;
        }
      }
      const available = product ? (avail.get(product.id) ?? 0) : undefined;
      const overQty =
        product && quantity !== null && available !== undefined ? quantity > available : false;
      rows.push({
        rowNumbers,
        productId: product ? product.id : null,
        sku: raws[0].sku,
        barcode: raws[0].barcode,
        productName: product ? product.name : raws[0].name,
        quantity,
        stockValue: stockValue ?? undefined,
        notes: raws.map((r) => r.notes).find((n) => !!n),
        available,
        overQty,
        merged: raws.length > 1,
        errors,
      });
    }
    rows.sort((a, b) => a.rowNumbers[0] - b.rowNumbers[0]);
    return {
      rows,
      validCount: rows.filter((r) => r.errors.length === 0 && !r.overQty).length,
      errorCount: rows.filter((r) => r.errors.length > 0).length,
      overQtyCount: rows.filter((r) => r.overQty).length,
      mergedCount: rows.filter((r) => r.merged).length,
    };
  }

  /**
   * Confirm a previewed import. Valid rows go through create() (TAMBAH) or
   * the reduce-to-target path (REPLACE); over-qty rows are SKIPPED and
   * reported per product — never partial row writes.
   */
  async confirmImport(dto: ConfirmImportDto, userId: string) {
    if (!dto.rows || dto.rows.length === 0) {
      throw new BadRequestException('Tidak ada baris valid untuk diimport');
    }
    if (dto.mode !== 'TAMBAH' && dto.mode !== 'REPLACE') {
      throw new BadRequestException('Mode must be TAMBAH or REPLACE');
    }
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    const stocks = await this.prisma.productStock.findMany({
      where: { productId: { in: dto.rows.map((r) => r.productId) }, warehouseId: dto.warehouseId },
      select: { productId: true, quantityAvailable: true },
    });
    const avail = new Map(stocks.map((s) => [s.productId, Number(s.quantityAvailable)]));
    const skipped: Array<{ productId: string; requested: number; available: number; reason: string }> = [];
    const valid: typeof dto.rows = [];
    for (const r of dto.rows) {
      const available = avail.get(r.productId) ?? 0;
      const limit = dto.mode === 'TAMBAH' ? r.quantity <= available : true;
      if (!limit) {
        skipped.push({
          productId: r.productId,
          requested: r.quantity,
          available,
          reason: `Stok tidak cukup (minta ${r.quantity}, tersedia ${available})`,
        });
      } else {
        valid.push(r);
      }
    }
    // REPLACE reduce-to-target: rows already at/below target remove nothing
    const effective = valid.filter((r) => {
      if (dto.mode !== 'REPLACE') return true;
      const available = avail.get(r.productId) ?? 0;
      if (available <= r.quantity) {
        skipped.push({
          productId: r.productId,
          requested: r.quantity,
          available,
          reason: `Stok sudah di bawah target (${available} ≤ ${r.quantity}) — tidak ada yang dikeluarkan`,
        });
        return false;
      }
      return true;
    });
    if (effective.length === 0) {
      const err = new BadRequestException(
        'Tidak ada baris valid untuk diimport (semua baris melebihi stok)',
      );
      await this.writeFailedLog('STOCK_OUT', dto, userId, err, dto.rows.length);
      throw err;
    }
    const reason = dto.reason?.trim() || `Import ${dto.mode} dari file ${dto.fileName}`;
    try {
      const doc =
        dto.mode === 'TAMBAH'
          ? await this.create(
              {
                outletId: dto.outletId,
                warehouseId: dto.warehouseId,
                reason,
                items: effective.map((r) => ({
                  productId: r.productId,
                  quantity: r.quantity,
                  stockValue: r.stockValue,
                })),
              },
              userId,
            )
          : await this.confirmReplace(dto, effective, reason, warehouse, userId);
      const log = await this.prisma.stockImportLog.create({
        data: {
          type: 'STOCK_OUT',
          fileName: dto.fileName,
          mode: dto.mode,
          outletId: dto.outletId || null,
          warehouseId: dto.warehouseId,
          totalRows: dto.rows.length,
          successRows: effective.length,
          skippedRows: skipped.length,
          status: skipped.length > 0 ? 'PARTIAL' : 'SUCCESS',
          errorSummary: skipped.length
            ? skipped.map((s) => `${s.productId}: ${s.reason}`).join('; ').slice(0, 1000)
            : null,
          referenceId: (doc as any).id,
          createdBy: userId,
        },
      });
      return { doc, skipped, logId: log.id };
    } catch (e: any) {
      await this.writeFailedLog('STOCK_OUT', dto, userId, e, dto.rows.length);
      throw e;
    }
  }

  /**
   * REPLACE for Stock Out = reduce each SKU down to the file quantity
   * (surplus only; never adds stock). Warehouse may be outlet GOOD or the
   * system Central Bad Stock warehouse (same rule as create()).
   */
  private async confirmReplace(
    dto: ConfirmImportDto,
    rows: ConfirmImportDto['rows'],
    reason: string,
    warehouse: any,
    userId: string,
  ) {
    const isOutletGood = warehouse.type === 'GOOD' && warehouse.scope === 'OUTLET';
    const isSystemBad = warehouse.type === 'BAD' && warehouse.scope === 'SYSTEM';
    let outletId: string | null = null;
    if (isOutletGood) {
      if (!dto.outletId) throw new BadRequestException('Outlet is required for an outlet warehouse');
      if (warehouse.outletId !== dto.outletId) {
        throw new BadRequestException('Selected warehouse must belong to the selected outlet');
      }
      outletId = warehouse.outletId;
    } else if (!isSystemBad) {
      throw new BadRequestException(
        'Selected warehouse must be an outlet GOOD warehouse or the Central Bad Stock warehouse',
      );
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: rows.map((r) => r.productId) } },
      include: { unit: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    const resolved = rows.map((r) => {
      const product = productMap.get(r.productId);
      if (!product) throw new NotFoundException(`Product ${r.productId} not found`);
      const stockValue =
        r.stockValue !== undefined
          ? r.stockValue
          : product.minSellingPrice !== null && product.minSellingPrice !== undefined
            ? Number(product.minSellingPrice)
            : Number(product.sellingPrice);
      return {
        productId: r.productId,
        productName: product.name,
        productSku: product.sku,
        targetQty: r.quantity,
        unitId: product.unitId || undefined,
        unitName: (product as any).unit?.name || null,
        stockValue,
      };
    });

    const documentNumber = this.generateDocumentNumber();
    const fileName = dto.fileName;
    return await this.prisma.$transaction(async (tx) => {
      const stockOut = await tx.stockOut.create({
        data: {
          documentNumber,
          outletId,
          warehouseId: warehouse.id,
          documentDate: new Date(),
          reason,
          createdBy: userId,
          items: { create: [] },
        },
        include: { items: true },
      });

      for (const line of resolved) {
        const stock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: { productId: line.productId, warehouseId: warehouse.id },
          },
        });
        const quantityBefore = stock ? Number(stock.quantityAvailable) : 0;
        const removeQty = quantityBefore - line.targetQty;
        if (!stock || removeQty <= 0) continue; // re-check inside tx; nothing to remove
        const quantityAfter = line.targetQty;
        await tx.productStock.update({
          where: {
            productId_warehouseId: { productId: line.productId, warehouseId: warehouse.id },
          },
          data: { quantityAvailable: new Decimal(quantityAfter) },
        });
        const lineTotal = new Decimal(removeQty).mul(new Decimal(line.stockValue)).toDecimalPlaces(2);
        await tx.stockOutItem.create({
          data: {
            stockOutId: stockOut.id,
            productId: line.productId,
            productName: line.productName,
            productSku: line.productSku,
            quantity: new Decimal(removeQty),
            unitId: line.unitId,
            unitName: line.unitName,
            stockValue: new Decimal(line.stockValue),
            lineTotal,
          },
        });
        await tx.stockMovement.create({
          data: {
            productId: line.productId,
            warehouseId: warehouse.id,
            branchId: outletId,
            movementType: 'OUT',
            referenceType: 'STOCK_OUT',
            referenceId: stockOut.id,
            quantityChange: new Decimal(-removeQty),
            quantityBefore: new Decimal(quantityBefore),
            quantityAfter: new Decimal(quantityAfter),
            notes: `Import REPLACE ${fileName}: ${documentNumber} - ${reason}`,
            createdBy: userId,
          },
        });
      }

      const items = await tx.stockOutItem.findMany({ where: { stockOutId: stockOut.id } });
      const totalValue = items.reduce(
        (sum, it) => sum.add(new Decimal(it.quantity).mul(new Decimal(it.stockValue))),
        new Decimal(0),
      );
      return tx.stockOut.update({
        where: { id: stockOut.id },
        data: { totalValue: totalValue.toDecimalPlaces(2) },
        include: {
          items: { include: { product: true } },
          outlet: true,
          warehouse: true,
        },
      });
    }).then((doc) => this.serialize(doc));
  }

  /** Best-effort FAILED audit row — never masks the original error. */
  private async writeFailedLog(
    type: string,
    dto: { fileName: string; mode: string; outletId?: string; warehouseId: string },
    userId: string,
    e: any,
    totalRows: number,
  ) {
    try {
      await this.prisma.stockImportLog.create({
        data: {
          type,
          fileName: dto.fileName,
          mode: dto.mode,
          outletId: dto.outletId || null,
          warehouseId: dto.warehouseId,
          totalRows,
          successRows: 0,
          skippedRows: totalRows,
          status: 'FAILED',
          errorSummary: String(e?.message || e).slice(0, 1000),
          createdBy: userId,
        },
      });
    } catch {
      // audit must never break the error path
    }
  }

  /** Current warehouse stock as xlsx — identical columns to the template. */
  async exportSnapshot(warehouseId: string) {
    const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    const stocks = await this.prisma.productStock.findMany({
      where: { warehouseId },
      include: { product: true },
      orderBy: { product: { name: 'asc' } },
    });
    const buffer = await buildSnapshotWorkbook(
      stocks.map((s) => ({
        sku: s.product.sku,
        barcode: s.product.barcode,
        name: s.product.name,
        quantity: Number(s.quantityAvailable),
        stockValue:
          s.product.minSellingPrice !== null && s.product.minSellingPrice !== undefined
            ? Number(s.product.minSellingPrice)
            : Number(s.product.sellingPrice),
      })),
    );
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return { buffer, filename: `stok-${warehouse.code}-${stamp}.xlsx` };
  }
}
