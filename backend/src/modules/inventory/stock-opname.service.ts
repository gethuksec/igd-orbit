import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { StartOpnameDto } from './dto/start-opname.dto';
import { RecordCountDto, OpnameItemDto } from './dto/record-count.dto';
import { AddAssignmentDto } from './dto/add-assignment.dto';
import { Decimal } from '@prisma/client/runtime/library';

const ACTIVE_STATUSES = ['draft', 'counting'] as const;

/**
 * IGDERP-234 (OP2): roles that may see system/expected/variance on opname
 * reads. Everyone else (counters: HS/ASA/SODO/…) gets a blind view —
 * product identity + their saved physical counts only.
 * Callers that pass no viewer (internal flows: export, approval) keep full.
 */
const FULL_VIEW_ROLES = ['SPV', 'CSO', 'OWNER', 'SUPERADMIN'];

export type OpnameViewer = { id: string; roles?: string[] };

type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

@Injectable()
export class StockOpnameService {
  constructor(private prisma: PrismaService) {}

  private generateOpnameNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `OP-${dateStr}-${random}`;
  }

  /**
   * IGDERP-233 (OP1): short human join code for multi-user sessions
   * (Menu > Opname > Count > Code), e.g. OPN-7K2QD.
   */
  private generateOpnameCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
    let suffix = '';
    for (let i = 0; i < 5; i++) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return `OPN-${suffix}`;
  }

  // prisma typed as any: both PrismaService and tx clients satisfy the
  // { stockOpname.findFirst } surface the generator needs (avoids delegate
  // generic-vs-concrete assignability friction).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async generateUniqueOpnameCode(prisma: any): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.generateOpnameCode();
      const existing = await prisma.stockOpname.findFirst({ where: { code } });
      if (!existing) return code;
    }
    // Astronomically unlikely — fall back to a timestamp-suffixed code
    return `OPN-${Date.now().toString(36).toUpperCase().slice(-5)}`;
  }

  /** Fetch live product_stock for every item of an opname and attach as `liveQuantity`. */
  private async attachLiveQuantities(opname: any) {
    const productIds = (opname.items ?? []).map((i: any) => i.productId);
    const stocks =
      productIds.length > 0
        ? await this.prisma.productStock.findMany({
            where: {
              warehouseId: opname.warehouseId,
              productId: { in: productIds },
            },
          })
        : [];
    const byProduct = new Map(stocks.map((s) => [s.productId, s]));
    return {
      ...opname,
      items: (opname.items ?? []).map((i: any) => ({
        ...i,
        liveQuantity: byProduct.get(i.productId)?.quantityAvailable ?? new Decimal(0),
      })),
    };
  }

  private assertActive(opname: { status: string; opnameNumber: string }, action: string) {
    if (!ACTIVE_STATUSES.includes(opname.status as ActiveStatus)) {
      throw new BadRequestException(
        `Cannot ${action} for opname with status: ${opname.status}`,
      );
    }
  }

  /**
   * IGDERP-234 (OP2): blind-count enforcement. No viewer (internal callers)
   * keeps full visibility; an explicit role list without a reviewer role is
   * blind. Counters must never see system/expected/variance — not even via
   * product costPrice (variance value is derivable from it).
   */
  private canSeeVariance(roles?: string[]): boolean {
    if (!roles) return true;
    return roles.some((r) => FULL_VIEW_ROLES.includes(r));
  }

  /** IGDERP-234 (OP2): strip system/expected/variance + cost from a loaded opname. */
  private stripBlindView(opname: any) {
    const { totalDiscrepancyValue, ...restOpname } = opname;
    return {
      ...restOpname,
      items: (opname.items ?? []).map((i: any) => {
        const {
          systemQuantity,
          systemQuantityAtCount,
          discrepancy,
          discrepancyValue,
          liveQuantity,
          ...safeItem
        } = i;
        const { costPrice, ...safeProduct } = i.product ?? {};
        return { ...safeItem, product: safeProduct };
      }),
    };
  }

  /**
   * IGDERP-234 (OP2): category scope for a counter. Null = whole session
   * (no assignments yet, or this user has none — unassigned users keep full
   * visibility so nobody is ever locked out of a count).
   */
  private async getUserScope(prisma: any, opnameId: string, userId: string): Promise<string[] | null> {
    const all = await prisma.opnameAssignment.findMany({ where: { opnameId } });
    if (!all || all.length === 0) return null;
    const mine = all.filter((a: any) => a.userId === userId).map((a: any) => a.categoryId);
    return mine.length > 0 ? mine : null;
  }

  /**
   * IGDERP-234 (OP2): fan a count payload out to per-condition lines.
   * Split quantities (GOOD/RUSAK/KADALUARSA) win when any is present;
   * otherwise the legacy physicalQuantity + condition applies.
   */
  private expandCountLines(item: OpnameItemDto) {
    const base = {
      productId: item.productId,
      notes: item.notes,
      force: item.force,
      countedBy: item.countedBy,
    };
    const splits = [
      { condition: 'good', qty: item.goodQuantity },
      { condition: 'damaged', qty: item.damagedQuantity },
      { condition: 'expired', qty: item.expiredQuantity },
    ].filter((s) => s.qty !== undefined && s.qty !== null);
    if (splits.length > 0) {
      return splits.map((s) => ({ ...base, physicalQuantity: s.qty as number, condition: s.condition as 'good' | 'damaged' | 'expired' }));
    }
    if (item.physicalQuantity === undefined || item.physicalQuantity === null) {
      throw new BadRequestException(
        `Product ${item.productId} has no quantity — send physicalQuantity or good/damaged/expired quantities`,
      );
    }
    return [{ ...base, physicalQuantity: item.physicalQuantity, condition: item.condition }];
  }

  async startOpname(dto: StartOpnameDto, userId: string) {
    const { warehouseId, branchId: legacyBranchId, opnameDate, notes, approverId } = dto;
    // IGDERP-233 (OP1): default FREEZE preserves the old implicit-freeze behaviour
    const opnameType = dto.opnameType ?? 'FREEZE';
    const categoryIds = dto.categoryIds?.length ? dto.categoryIds : undefined;

    const warehouse = warehouseId
      ? await this.prisma.warehouse.findUnique({ where: { id: warehouseId } })
      : legacyBranchId
        ? await this.prisma.warehouse.findFirst({
            where: {
              outletId: legacyBranchId,
              type: 'GOOD',
              scope: 'OUTLET',
              isActive: true,
            },
            orderBy: { createdAt: 'asc' },
          })
        : null;

    if (!warehouse) {
      throw new NotFoundException(
        warehouseId ? 'Warehouse not found' : 'An active outlet warehouse is required',
      );
    }

    if (!warehouse.isActive) {
      throw new BadRequestException('Cannot start opname for an inactive warehouse');
    }

    const effectiveBranchId = warehouse.outletId;

    // One active opname (draft/counting) per warehouse/outlet
    const activeOpname = await this.prisma.stockOpname.findFirst({
      where: {
        warehouseId: warehouse.id,
        status: {
          in: ['draft', 'counting'],
        },
      },
    });

    if (activeOpname) {
      throw new BadRequestException(
        `There is an active opname (${activeOpname.opnameNumber}) for this outlet. Please complete or cancel it first.`,
      );
    }

    // Get all products with stock in this warehouse (optionally scoped to categories)
    const stocks = await this.prisma.productStock.findMany({
      where: {
        warehouseId: warehouse.id,
        product: {
          isActive: true,
          deletedAt: null,
          ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
        },
      },
      include: {
        product: true,
      },
    });

    // Create opname with items
    const code = await this.generateUniqueOpnameCode(this.prisma);
    return await this.prisma.$transaction(async (tx) => {
      const opname = await tx.stockOpname.create({
        data: {
          opnameNumber: this.generateOpnameNumber(),
          code,
          opnameType,
          approverId: approverId ?? null,
          warehouseId: warehouse.id,
          branchId: effectiveBranchId,
          opnameDate: new Date(opnameDate),
          status: 'draft',
          startedBy: userId,
          notes,
          items: {
            create: stocks.map((stock) => ({
              productId: stock.productId,
              systemQuantity: stock.quantityAvailable,
              physicalQuantity: null,
              discrepancy: null,
              discrepancyValue: null,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  brand: true,
                },
              },
            },
          },
          branch: true,
        },
      });

      // Update status to counting
      return tx.stockOpname.update({
        where: { id: opname.id },
        data: {
          status: 'counting',
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  brand: true,
                },
              },
            },
          },
          branch: true,
        },
      });
    });
  }

  async findAll(branchId?: string, status?: string, branchIds?: string[], viewer?: { roles?: string[] }) {
    const where: any = {};

    if (branchId) {
      where.branchId = branchId;
    } else if (branchIds?.length) {
      // "Semua Cabang" → user's accessible branches only
      where.branchId = { in: branchIds };
    }

    if (status) {
      where.status = status;
    }

    const opnames = await this.prisma.stockOpname.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
          },
        },
        branch: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // IGDERP-234 (OP2): counters get blind list rows (no system/variance).
    const blind = !this.canSeeVariance(viewer?.roles);
    const withLive = await Promise.all(opnames.map((o) => this.attachLiveQuantities(o)));
    return blind ? withLive.map((o) => this.stripBlindView(o)) : withLive;
  }

  async findById(id: string, viewer?: { roles?: string[] }) {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
          },
        },
        branch: true,
      },
    });

    if (!opname) {
      throw new NotFoundException('Opname not found');
    }

    // IGDERP-234 (OP2): blind view for counters (API-level enforcement).
    const withLive = await this.attachLiveQuantities(opname);
    return this.canSeeVariance(viewer?.roles) ? withLive : this.stripBlindView(withLive);
  }

  /**
   * IGDERP-233 (OP1): join a session by its short code (Menu > Opname > Count > Code).
   * Blind-count clients use the id from here for subsequent calls.
   */
  async findByCode(code: string, viewer?: { roles?: string[] }) {
    const normalized = code.trim().toUpperCase();
    const opname = await this.prisma.stockOpname.findFirst({
      where: { code: normalized },
      select: { id: true },
    });

    if (!opname) {
      throw new NotFoundException('Opname session not found for this code');
    }

    return this.findById(opname.id, viewer);
  }

  /**
   * IGDERP-234 (OP2): counter-facing count view — category-scoped to the
   * caller's assignments and blind to system/expected/variance unless the
   * caller holds a reviewer role. Manual refresh (draft model, no push).
   */
  async getCountView(opnameId: string, viewer: OpnameViewer) {
    const opname: any = await this.findById(opnameId);
    const scope = await this.getUserScope(this.prisma, opnameId, viewer.id);
    const assignments = await this.prisma.opnameAssignment.findMany({
      where: { opnameId },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });
    const items = scope
      ? (opname.items ?? []).filter((i: any) => scope.includes(i.product?.categoryId))
      : (opname.items ?? []);
    const view = { ...opname, items, myCategoryIds: scope, assignments };
    return this.canSeeVariance(viewer.roles) ? view : this.stripBlindView(view);
  }

  /**
   * IGDERP-234 (OP2): resolve a scanned barcode/SKU to the in-scope opname
   * line(s). Identity only — never system stock. Unknown barcodes are a 404
   * (FE shows the exception popup and logs); lines outside the caller's
   * assignment are a 403 with no log. Never creates a count line.
   */
  async resolveBarcode(opnameId: string, rawBarcode: string, viewer: OpnameViewer) {
    const barcode = (rawBarcode ?? '').trim();
    if (!barcode) {
      throw new BadRequestException('Barcode is required');
    }
    const opname: any = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
      include: {
        items: { include: { product: { include: { category: true } } } },
      },
    });
    if (!opname) {
      throw new NotFoundException('Opname not found');
    }
    this.assertActive(opname, 'scan items in');

    const upper = barcode.toUpperCase();
    const candidates = (opname.items ?? []).filter(
      (i: any) =>
        i.product &&
        (i.product.barcode === barcode ||
          i.product.sku === barcode ||
          (i.product.sku && i.product.sku.toUpperCase() === upper)),
    );
    if (candidates.length === 0) {
      throw new NotFoundException('UNKNOWN_BARCODE');
    }
    const scope = await this.getUserScope(this.prisma, opnameId, viewer.id);
    const inScope = scope
      ? candidates.filter((i: any) => scope.includes(i.product.categoryId))
      : candidates;
    if (inScope.length === 0) {
      throw new ForbiddenException('OUT_OF_SCOPE');
    }
    const product = inScope[0].product;
    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        category: product.category ? { id: product.category.id, name: product.category.name } : null,
      },
      lines: inScope.map((i: any) => ({
        itemId: i.id,
        condition: i.condition ?? 'good',
        physicalQuantity: i.physicalQuantity === null || i.physicalQuantity === undefined
          ? null
          : i.physicalQuantity.toString(),
        countedBy: i.countedBy ?? null,
      })),
    };
  }

  /**
   * IGDERP-234 (OP2): assign a counter to categories. Addable mid-session;
   * existing rows are kept (no duplicates). Returns the session roster.
   */
  async addAssignments(opnameId: string, dto: AddAssignmentDto) {
    const opname = await this.prisma.stockOpname.findUnique({ where: { id: opnameId } });
    if (!opname) {
      throw new NotFoundException('Opname not found');
    }
    this.assertActive(opname, 'change assignments in');

    const cats = await this.prisma.category.findMany({ where: { id: { in: dto.categoryIds } } });
    if (cats.length !== dto.categoryIds.length) {
      throw new BadRequestException('One or more categories do not exist');
    }
    for (const categoryId of dto.categoryIds) {
      const existing = await this.prisma.opnameAssignment.findFirst({
        where: { opnameId, userId: dto.userId, categoryId },
      });
      if (!existing) {
        await this.prisma.opnameAssignment.create({ data: { opnameId, userId: dto.userId, categoryId } });
      }
    }
    return this.listAssignments(opnameId);
  }

  async listAssignments(opnameId: string) {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
      select: { id: true },
    });
    if (!opname) {
      throw new NotFoundException('Opname not found');
    }
    return this.prisma.opnameAssignment.findMany({
      where: { opnameId },
      include: { category: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * IGDERP-234 (OP2): log an unknown-barcode attempt for the coordinator.
   * Never creates a count line.
   */
  async logException(opnameId: string, rawBarcode: string, userId: string) {
    const opname = await this.prisma.stockOpname.findUnique({ where: { id: opnameId } });
    if (!opname) {
      throw new NotFoundException('Opname not found');
    }
    this.assertActive(opname, 'log exceptions in');
    const barcode = (rawBarcode ?? '').trim().slice(0, 64);
    if (!barcode) {
      throw new BadRequestException('Barcode is required');
    }
    return this.prisma.opnameException.create({ data: { opnameId, barcode, scannedBy: userId } });
  }

  async listExceptions(opnameId: string) {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
      select: { id: true },
    });
    if (!opname) {
      throw new NotFoundException('Opname not found');
    }
    return this.prisma.opnameException.findMany({
      where: { opnameId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /**
   * IGDERP-234 (OP2): session progress — who counted what. Served on demand
   * (manual refresh / poll); there is deliberately no push channel — the
   * draft model (IGDERP-92) keeps refresh manual.
   */
  async getProgress(opnameId: string) {
    const opname: any = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
      include: {
        items: {
          select: {
            productId: true,
            physicalQuantity: true,
            condition: true,
            countedBy: true,
          },
        },
      },
    });
    if (!opname) {
      throw new NotFoundException('Opname not found');
    }
    const [scans, assignments, exceptionsCount] = await Promise.all([
      this.prisma.opnameScan.findMany({
        where: { opnameId },
        orderBy: { createdAt: 'desc' },
        take: 500,
      }),
      this.listAssignments(opnameId),
      this.prisma.opnameException.count({ where: { opnameId } }),
    ]);

    const items = opname.items ?? [];
    const countedRows = items.filter(
      (i: any) => i.physicalQuantity !== null && i.physicalQuantity !== undefined,
    );
    const countedProducts = new Set(countedRows.map((i: any) => i.productId));

    const byUser = new Map<string, { rows: number; products: Set<string>; quantity: number }>();
    for (const i of countedRows) {
      const key = i.countedBy ?? 'unknown';
      if (!byUser.has(key)) byUser.set(key, { rows: 0, products: new Set(), quantity: 0 });
      const entry = byUser.get(key) as { rows: number; products: Set<string>; quantity: number };
      entry.rows += 1;
      entry.products.add(i.productId);
      entry.quantity += Number(i.physicalQuantity);
    }
    const lastScanBy = new Map<string, Date>();
    for (const s of scans) {
      if (!lastScanBy.has(s.scannedBy)) lastScanBy.set(s.scannedBy, s.createdAt);
    }
    const knownIds = [...byUser.keys()].filter((k) => k !== 'unknown');
    const users = knownIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: knownIds } },
          select: { id: true, fullName: true, username: true },
        })
      : [];
    const nameById = new Map(users.map((u: any) => [u.id, u.fullName || u.username || u.id]));

    return {
      totals: {
        rows: items.length,
        countedRows: countedRows.length,
        remainingRows: items.length - countedRows.length,
        products: new Set(items.map((i: any) => i.productId)).size,
        countedProducts: countedProducts.size,
        scanEvents: scans.length,
        exceptions: exceptionsCount,
      },
      byUser: [...byUser.entries()].map(([userId, e]) => ({
        userId,
        displayName: nameById.get(userId) ?? (userId === 'unknown' ? '-' : userId),
        rows: e.rows,
        products: e.products.size,
        quantity: e.quantity,
        lastScanAt: lastScanBy.get(userId) ?? null,
      })),
      assignments,
    };
  }

  /**
   * IGDERP-177 — result document export (.xlsx, ExcelJS).
   * Header meta + variance summary + one row per counted line
   * (one row per product+condition after IGDERP-175).
   */
  async exportOpname(id: string): Promise<{ buffer: Buffer; filename: string }> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExcelJS = require('exceljs');
    const opname: any = await this.findById(id);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'IGD-ERP';
    const ws = wb.addWorksheet('Hasil Opname');

    ws.columns = [
      { header: 'Produk', key: 'product', width: 32 },
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Barcode', key: 'barcode', width: 20 },
      { header: 'Stok Sistem', key: 'system', width: 13 },
      { header: 'Stok Fisik', key: 'physical', width: 13 },
      { header: 'Selisih', key: 'discrepancy', width: 12 },
      { header: 'Selisih %', key: 'pct', width: 11 },
      { header: 'Nilai Selisih', key: 'value', width: 16 },
      { header: 'Kondisi', key: 'condition', width: 12 },
      { header: 'Catatan', key: 'notes', width: 30 },
    ];

    const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString('id-ID') : '-');
    ws.addRow([`Hasil Opname ${opname.opnameNumber}`]);
    ws.addRow([`Cabang: ${opname.branch?.name || '-'} · Tanggal: ${fmtDate(opname.opnameDate)} · Status: ${opname.status}`]);
    const items: any[] = opname.items ?? [];
    const counted = items.filter((i) => i.physicalQuantity !== null && i.physicalQuantity !== undefined);
    const withDiff = counted.filter((i) => Number(i.discrepancy || 0) !== 0);
    const totalValue = counted.reduce((s, i) => s + Number(i.discrepancyValue || 0), 0);
    ws.addRow([
      `Item: ${items.length} · Dihitung: ${counted.length} · Selisih: ${withDiff.length} · Nilai: ${totalValue}`,
    ]);
    ws.addRow([]);

    const condLabel = (c: string | null) =>
      c === 'damaged' ? 'Rusak' : c === 'expired' ? 'Kadaluarsa' : 'Baik';
    for (const item of items) {
      const sys = Number(item.systemQuantity || 0);
      const phys = item.physicalQuantity === null || item.physicalQuantity === undefined
        ? null
        : Number(item.physicalQuantity);
      const diff = phys === null ? null : Number(item.discrepancy ?? phys - sys);
      const pct = phys === null || sys <= 0 || diff === null ? null : Math.abs(diff / sys) * 100;
      ws.addRow({
        product: item.product?.name || '-',
        sku: item.product?.sku || '-',
        barcode: item.product?.barcode || '-',
        system: sys,
        physical: phys,
        discrepancy: diff,
        pct: pct === null ? null : Math.round(pct * 10) / 10,
        value: phys === null ? null : Number(item.discrepancyValue || 0),
        condition: phys === null ? null : condLabel(item.condition),
        notes: item.notes || null,
      });
    }
    ws.getRow(5).font = { bold: true };

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return { buffer, filename: `opname-${opname.opnameNumber}.xlsx` };
  }

  /** Draft model: add a product to an ongoing (draft/counting) opname. */
  async addItem(opnameId: string, productId: string, viewer?: OpnameViewer) {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
    });

    if (!opname) {
      throw new NotFoundException('Opname not found');
    }
    this.assertActive(opname, 'add items to');

    const product = await this.prisma.product.findFirst({
      where: { id: productId, isActive: true, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException('Product not found or inactive');
    }

    const existing = await this.prisma.stockOpnameItem.findFirst({
      where: { opnameId, productId },
    });
    if (existing) {
      throw new BadRequestException('Product is already in this opname');
    }

    // System quantity = LIVE stock at add time (0 when no stock row exists yet)
    const stock = await this.prisma.productStock.findUnique({
      where: {
        productId_warehouseId: { productId, warehouseId: opname.warehouseId },
      },
    });

    await this.prisma.stockOpnameItem.create({
      data: {
        opnameId,
        productId,
        systemQuantity: stock ? stock.quantityAvailable : new Decimal(0),
        physicalQuantity: null,
        discrepancy: null,
        discrepancyValue: null,
      },
    });

    // IGDERP-234 (OP2): counters get their scoped blind view back.
    return viewer ? this.getCountView(opnameId, viewer) : this.findById(opnameId);
  }

  /** Draft model: remove a row from an ongoing (draft/counting) opname. IGDERP-175: item-id based (one row per product+condition). */
  async removeItem(opnameId: string, itemId: string, viewer?: OpnameViewer) {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
    });

    if (!opname) {
      throw new NotFoundException('Opname not found');
    }
    this.assertActive(opname, 'remove items from');

    const item = await this.prisma.stockOpnameItem.findFirst({
      where: { id: itemId, opnameId },
    });
    if (!item) {
      throw new NotFoundException('Opname item not found');
    }

    await this.prisma.stockOpnameItem.delete({ where: { id: item.id } });

    // IGDERP-234 (OP2): counters get their scoped blind view back.
    return viewer ? this.getCountView(opnameId, viewer) : this.findById(opnameId);
  }

  /** Cancel/void an ongoing opname, freeing the outlet for a new one. */
  async cancelOpname(opnameId: string, userId: string) {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
    });

    if (!opname) {
      throw new NotFoundException('Opname not found');
    }
    this.assertActive(opname, 'cancel');

    return this.prisma.stockOpname.update({
      where: { id: opnameId },
      data: {
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: new Date(),
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
          },
        },
        branch: true,
      },
    });
  }

  async recordCount(opnameId: string, dto: RecordCountDto, userId: string, userRoles?: string[]) {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!opname) {
      throw new NotFoundException('Opname not found');
    }

    if (opname.status !== 'counting') {
      throw new BadRequestException(`Cannot record count for opname with status: ${opname.status}`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // IGDERP-175: one row per (product, condition). A scan carrying a
      // condition targets the row with that condition: same-condition
      // re-scan of a counted row is a 409 (FE shows the reject modal),
      // a new condition creates a second row (service-level enforcement,
      // no migration — condition stays nullable).
      for (const raw of dto.items) {
        // IGDERP-234 (OP2): one scan fans out to one row per non-zero
        // condition (GOOD/RUSAK/KADALUARSA); legacy payloads yield one line.
        const lines = this.expandCountLines(raw);
        let goodQty = 0;
        let damagedQty = 0;
        let expiredQty = 0;
        for (const split of lines) {
          if (split.condition === 'damaged') damagedQty = split.physicalQuantity;
          else if (split.condition === 'expired') expiredQty = split.physicalQuantity;
          else goodQty = split.physicalQuantity;
        }
        // Rows for this product known so far (snapshot + rows created by
        // earlier lines of this same scan).
        const known: any[] = opname.items.filter((i: any) => i.productId === raw.productId);
        for (const item of lines) {
        // IGDERP-234 (OP2): in-memory mirror of this product's rows — split
        // lines in one scan must see each other's writes (the tx snapshot
        // above is stale after the first line creates/updates a row).
        const candidates = known.filter((i) => i.productId === item.productId);
        const cond = item.condition || undefined;

        if (!cond && candidates.length > 1) {
          throw new BadRequestException(
            `Product ${item.productId} has multiple condition rows — condition is required`,
          );
        }

        let opnameItem: any = cond
          ? candidates.find((i) => (i.condition || undefined) === cond)
          : candidates[0];

        if (!opnameItem && candidates.length === 0) {
          throw new NotFoundException(`Product ${item.productId} not found in opname items`);
        }

        // IGDERP-175: the first condition-carrying scan CLAIMS the uncounted
        // snapshot row (condition null) instead of creating a duplicate — the
        // placeholder row is the product's pre-scan state, so a fresh scan
        // must fill it rather than leave it dangling uncounted.
        if (cond && !opnameItem) {
          opnameItem = candidates.find(
            (i) =>
              !i.condition &&
              (i.physicalQuantity === null || i.physicalQuantity === undefined),
          );
        }

        if (
          opnameItem &&
          opnameItem.physicalQuantity !== null &&
          opnameItem.physicalQuantity !== undefined &&
          !item.force
        ) {
          // Scan-flow double-submit guard. Explicit corrections (table edit
          // via Draft SO) send force:true and overwrite instead.
          throw new ConflictException(
            `Product ${item.productId} already counted${cond ? ` with condition ${cond}` : ''}`,
          );
        }

        if (!opnameItem) {
          // Different-condition second row: snapshot live stock at creation,
          // mirroring addItem semantics.
          const liveStock0 = await tx.productStock.findUnique({
            where: {
              productId_warehouseId: {
                productId: item.productId,
                warehouseId: opname.warehouseId,
              },
            },
          });
          opnameItem = await tx.stockOpnameItem.create({
            data: {
              opnameId,
              productId: item.productId,
              systemQuantity: liveStock0 ? liveStock0.quantityAvailable : new Decimal(0),
              physicalQuantity: null,
              discrepancy: null,
              discrepancyValue: null,
              condition: cond,
            },
          });
          // Same product as the candidate rows — reuse their loaded relation
          // for the costPrice math below (create returns no includes).
          const sibling = candidates[0];
          if (sibling) opnameItem.product = sibling.product;
          // IGDERP-234 (OP2): mirror the new row for later split lines.
          opnameItem.condition = cond;
          opnameItem.physicalQuantity = null;
          known.push(opnameItem);
        }

        const systemQuantity = Number(opnameItem.systemQuantity);
        const physicalQuantity = item.physicalQuantity;
        const discrepancy = physicalQuantity - systemQuantity;
        const costPrice = Number(opnameItem.product.costPrice);
        const discrepancyValue = discrepancy * costPrice;

        // Capture LIVE system stock at the moment the count is recorded —
        // used at approval time for sale-safe reconciliation (sales that
        // happened during the opname are not overwritten).
        const liveStock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: opname.warehouseId,
            },
          },
        });

        await tx.stockOpnameItem.update({
          where: { id: opnameItem.id },
          data: {
            physicalQuantity: new Decimal(physicalQuantity),
            systemQuantityAtCount: liveStock
              ? liveStock.quantityAvailable
              : new Decimal(0),
            discrepancy: new Decimal(discrepancy),
            discrepancyValue: new Decimal(discrepancyValue),
            condition: item.condition,
            notes: item.notes,
            countedBy: item.countedBy || userId,
          },
        });
        // IGDERP-234 (OP2): mirror the write for later split lines.
        opnameItem.physicalQuantity = new Decimal(physicalQuantity);
        opnameItem.condition = item.condition;
        opnameItem.countedBy = item.countedBy || userId;
      }

      // IGDERP-234 (OP2): append-only scan event for this product.
      const lastScan = await tx.opnameScan.findFirst({
        where: { opnameId, productId: raw.productId },
        orderBy: { revision: 'desc' },
      });
      await tx.opnameScan.create({
        data: {
          opnameId,
          productId: raw.productId,
          goodQuantity: new Decimal(goodQty),
          damagedQuantity: new Decimal(damagedQty),
          expiredQuantity: new Decimal(expiredQty),
          scannedBy: raw.countedBy || userId,
          revision: lastScan ? lastScan.revision + 1 : 1,
        },
      });
    }
    });

    // IGDERP-234 (OP2): counters get their scoped blind view back.
    return this.getCountView(opnameId, { id: userId, roles: userRoles });
  }

  async completeOpname(opnameId: string, userId: string) {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
      include: {
        items: true,
      },
    });

    if (!opname) {
      throw new NotFoundException('Opname not found');
    }

    if (opname.status !== 'counting') {
      throw new BadRequestException(`Cannot complete opname with status: ${opname.status}`);
    }

    // Validate all items are counted
    const uncountedItems = opname.items.filter((item) => item.physicalQuantity === null);

    if (uncountedItems.length > 0) {
      throw new BadRequestException(
        `${uncountedItems.length} items are not yet counted. Please count all items before completing.`,
      );
    }

    // Calculate total discrepancy value
    const totalDiscrepancyValue = opname.items.reduce((sum, item) => {
      return sum + Number(item.discrepancyValue || 0);
    }, 0);

    return this.prisma.stockOpname.update({
      where: { id: opnameId },
      data: {
        status: 'completed',
        completedBy: userId,
        completedAt: new Date(),
        totalDiscrepancyValue: new Decimal(totalDiscrepancyValue),
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
              },
            },
          },
        },
        branch: true,
      },
    });
  }

  /**
   * Sale-safe approval.
   *
   * For each item the final stock is reconciled against the LIVE stock at
   * approval time using the live quantity captured when the count was saved:
   *
   *   final = physical + liveNow - liveAtCount
   *
   * (counted 2, sold 1 → final 1; sales during the opname are preserved).
   * Items counted before this field existed (systemQuantityAtCount null)
   * fall back to final = physical (legacy behaviour).
   *
   * Damaged/expired lines are reclassified: the counted units move from
   * quantity_available into quantity_damaged, even when the quantity
   * discrepancy is zero.
   */
  async approveOpname(opnameId: string, userId: string) {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        branch: true,
      },
    });

    if (!opname) {
      throw new NotFoundException('Opname not found');
    }

    if (opname.status !== 'completed') {
      throw new BadRequestException(`Cannot approve opname with status: ${opname.status}`);
    }

    return await this.prisma.$transaction(async (tx) => {
      for (const item of opname.items) {
        if (item.physicalQuantity === null) continue; // defensive; complete validates

        // Current live stock (create a zero row if none exists)
        let stock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: opname.warehouseId,
            },
          },
        });

        if (!stock) {
          stock = await tx.productStock.create({
            data: {
              productId: item.productId,
              warehouseId: opname.warehouseId,
              branchId: opname.branchId,
              quantityAvailable: new Decimal(0),
              quantityReserved: new Decimal(0),
              quantityDamaged: new Decimal(0),
            },
          });
        }

        const liveNow = Number(stock.quantityAvailable);
        const physical = Number(item.physicalQuantity);
        const liveAtCount =
          item.systemQuantityAtCount !== null && item.systemQuantityAtCount !== undefined
            ? Number(item.systemQuantityAtCount)
            : null;

        // Reconcile against live stock (sale-safe)
        const finalTotal = liveAtCount !== null
          ? Math.max(0, physical + liveNow - liveAtCount)
          : physical;

        const isDamaged = item.condition === 'damaged' || item.condition === 'expired';
        const availableAfter = isDamaged ? Math.max(0, finalTotal - physical) : finalTotal;
        const damagedAfter = isDamaged
          ? Number(stock.quantityDamaged) + physical
          : Number(stock.quantityDamaged);

        const quantityChange = availableAfter - liveNow;

        // Movement only when stock actually changes (incl. pure reclassification)
        if (quantityChange !== 0 || (isDamaged && physical > 0)) {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              warehouseId: opname.warehouseId,
              branchId: opname.branchId,
              movementType: 'ADJUSTMENT',
              referenceType: 'OPNAME',
              referenceId: opnameId,
              quantityChange: new Decimal(quantityChange),
              quantityBefore: new Decimal(liveNow),
              quantityAfter: new Decimal(availableAfter),
              notes: `Stock opname adjustment${item.condition ? ` (${item.condition})` : ''}${item.notes ? ` - ${item.notes}` : ''}`,
              createdBy: userId,
            },
          });
        }

        await tx.productStock.update({
          where: {
            productId_warehouseId: {
              productId: item.productId,
              warehouseId: opname.warehouseId,
            },
          },
          data: {
            quantityAvailable: new Decimal(availableAfter),
            quantityDamaged: new Decimal(damagedAfter),
          },
        });
      }

      // Update opname status
      return tx.stockOpname.update({
        where: { id: opnameId },
        data: {
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  category: true,
                  brand: true,
                },
              },
            },
          },
          branch: true,
        },
      });
    });
  }
}
