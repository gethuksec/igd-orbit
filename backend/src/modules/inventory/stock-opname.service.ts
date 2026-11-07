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
import { UpsertApproverSettingDto } from './dto/upsert-approver-setting.dto';
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
      correctionReason: item.correctionReason,
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

    // IGDERP-236 (OP4): approver pre-fill from the General setting
    // (per-outlet person override, else first holder of the default role).
    // Explicit approverId from the start form always wins.
    const resolvedApproverId = approverId ?? (await this.resolveOutletApprover(effectiveBranchId));

    // One active opname (draft/counting/completed) per warehouse/outlet.
    // 'completed' blocks too: a counted-but-unapproved session must be
    // approved or cancelled first — otherwise two overlapping truths.
    const activeOpname = await this.prisma.stockOpname.findFirst({
      where: {
        warehouseId: warehouse.id,
        status: {
          in: ['draft', 'counting', 'completed'],
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
          approverId: resolvedApproverId ?? null,
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
            where: { deletedAt: null },
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
            where: { deletedAt: null },
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
          where: { deletedAt: null },
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
          where: { deletedAt: null },
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
        items: { where: { deletedAt: null }, include: { product: { include: { category: true } } } },
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
   * IGDERP-236 (OP4): Stock Opname approver setting (Administrator → Approval,
   * mirrored on General). Global default = role code (default 'HS'/Headstore —
   * the live role catalog has no MGR/SPV/CSO); per-outlet person override wins.
   */
  async getApproverSetting() {
    const [global, overrides] = await Promise.all([
      this.prisma.opnameApproverSetting.findFirst({ where: { outletId: null } }),
      this.prisma.opnameApproverSetting.findMany({
        where: { NOT: { outletId: null } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    const role = (global?.role ?? '').trim().toUpperCase();
    // Self-healing: a saved role deleted from the catalog (e.g. fossil MGR/SPV)
    // matches no holder — fall back to HS instead of returning a dead code.
    let defaultRole = role || 'HS';
    if (role) {
      const exists = await this.prisma.role.findUnique({
        where: { code: role },
        select: { code: true },
      });
      if (!exists) defaultRole = 'HS';
    }
    return {
      defaultRole,
      overrides: (overrides ?? []).map((o: any) => ({ outletId: o.outletId, userId: o.userId })),
    };
  }

  async upsertApproverSetting(dto: UpsertApproverSettingDto, updatedBy: string) {
    if (!dto.outletId) {
      const role = (dto.role ?? '').trim().toUpperCase();
      if (!role) throw new BadRequestException('Role is required for the global default');
      const existing = await this.prisma.opnameApproverSetting.findFirst({ where: { outletId: null } });
      if (existing) {
        return this.prisma.opnameApproverSetting.update({
          where: { id: existing.id },
          data: { role, updatedBy },
        });
      }
      return this.prisma.opnameApproverSetting.create({
        data: { outletId: null, role, updatedBy },
      });
    }
    if (dto.userId === null || dto.userId === undefined || dto.userId === '') {
      const existing = await this.prisma.opnameApproverSetting.findUnique({
        where: { outletId: dto.outletId },
      });
      if (existing) {
        await this.prisma.opnameApproverSetting.delete({ where: { id: existing.id } });
      }
      return { outletId: dto.outletId, userId: null };
    }
    const existing = await this.prisma.opnameApproverSetting.findUnique({
      where: { outletId: dto.outletId },
    });
    if (existing) {
      return this.prisma.opnameApproverSetting.update({
        where: { id: existing.id },
        data: { userId: dto.userId, updatedBy },
      });
    }
    return this.prisma.opnameApproverSetting.create({
      data: { outletId: dto.outletId, userId: dto.userId, updatedBy },
    });
  }

  /**
   * IGDERP-236 (OP4): resolve the effective approver for an outlet —
   * person override first, else the first active holder of the default role
   * at that outlet, else null (legacy sessions fall back to role gates).
   */
  async resolveOutletApprover(outletId: string | null | undefined): Promise<string | null> {
    if (!outletId) return null;
    const override = await this.prisma.opnameApproverSetting.findUnique({
      where: { outletId },
    });
    if (override?.userId) return override.userId;
    const setting = await this.getApproverSetting();
    const holders: any[] = await this.prisma.userBranch.findMany({
      where: {
        branchId: outletId,
        role: { code: setting.defaultRole },
        user: { isActive: true, deletedAt: null },
      },
      include: { user: { select: { id: true, createdAt: true } } },
      orderBy: { user: { createdAt: 'asc' } },
    });
    return holders[0]?.user?.id ?? holders[0]?.userId ?? null;
  }

  /**
   * IGDERP-236 (OP4): approver candidates for the start form — holders of
   * the default role at the outlet plus the override person (if any).
   * The session start pre-fills from this and is reassignable within it.
   */
  async getApproverCandidates(outletId: string) {
    const setting = await this.getApproverSetting();
    const [holders, override] = await Promise.all([
      this.prisma.userBranch.findMany({
        where: {
          branchId: outletId,
          role: { code: setting.defaultRole },
          user: { isActive: true, deletedAt: null },
        },
        include: {
          user: { select: { id: true, fullName: true, username: true } },
        },
        orderBy: { user: { createdAt: 'asc' } },
      }),
      this.prisma.opnameApproverSetting.findUnique({ where: { outletId } }),
    ]);
    const candidates = new Map<string, any>();
    for (const h of holders ?? []) {
      const u = h.user ?? { id: h.userId };
      candidates.set(u.id, {
        id: u.id,
        displayName: u.fullName || u.username || u.id,
      });
    }
    if (override?.userId && !candidates.has(override.userId)) {
      const u: any = await this.prisma.user.findUnique({
        where: { id: override.userId },
        select: { id: true, fullName: true, username: true },
      });
      if (u) candidates.set(u.id, { id: u.id, displayName: u.fullName || u.username || u.id });
    }
    const list = [...candidates.values()];
    return {
      defaultRole: setting.defaultRole,
      defaultUserId: override?.userId ?? list[0]?.id ?? null,
      candidates: list,
    };
  }

  async listApprovals(opnameId: string) {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
      select: { id: true },
    });
    if (!opname) {
      throw new NotFoundException('Opname not found');
    }
    return this.prisma.opnameApproval.findMany({
      where: { opnameId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listCorrections(opnameId: string) {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
      select: { id: true },
    });
    if (!opname) {
      throw new NotFoundException('Opname not found');
    }
    return this.prisma.opnameCorrection.findMany({
      where: { opnameId },
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { createdAt: 'desc' },
      take: 500,
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
          where: { deletedAt: null },
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
   * IGDERP-235 (OP3): variance review.
   * FREEZE: Variance = Physical − Snapshot.
   * OPEN: Expected = Snapshot + Σ movements (since the product's earliest
   * row), Variance = Physical − Expected. Variance Value = Variance × cost.
   * Products are aggregated across condition rows with a good/damaged/expired
   * breakdown; groups come out selisih-first for the C2 layout.
   */
  async getReview(opnameId: string, viewer?: { roles?: string[] }) {
    const opname: any = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
      include: {
        items: { where: { deletedAt: null }, include: { product: { include: { category: true } } } },
        movements: { orderBy: { createdAt: 'asc' } },
        branch: true,
      },
    });
    if (!opname) {
      throw new NotFoundException('Opname not found');
    }

    const isOpen = opname.opnameType === 'OPEN';
    const byProduct = new Map<string, any[]>();
    for (const i of opname.items ?? []) {
      const list = byProduct.get(i.productId) ?? [];
      list.push(i);
      byProduct.set(i.productId, list);
    }

    const products: any[] = [];
    for (const [productId, rows] of byProduct) {
      const ordered = [...rows].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      const baseline = new Date(ordered[0].createdAt).getTime();
      const snapshot = Number(ordered[0].systemQuantity);
      const movs = (opname.movements ?? []).filter(
        (m: any) => m.productId === productId && new Date(m.createdAt).getTime() >= baseline,
      );
      const movementTotal = movs.reduce((s: number, m: any) => s + Number(m.quantityChange), 0);
      const expected = isOpen ? snapshot + movementTotal : snapshot;

      const countedRows = rows.filter(
        (r: any) => r.physicalQuantity !== null && r.physicalQuantity !== undefined,
      );
      const physical = countedRows.length > 0
        ? countedRows.reduce((s: number, r: any) => s + Number(r.physicalQuantity), 0)
        : null;
      const breakdown = { good: 0, damaged: 0, expired: 0 };
      for (const r of countedRows) {
        const cond = r.condition ?? 'good';
        if (cond === 'damaged') breakdown.damaged += Number(r.physicalQuantity);
        else if (cond === 'expired') breakdown.expired += Number(r.physicalQuantity);
        else breakdown.good += Number(r.physicalQuantity);
      }
      const variance = physical === null ? null : physical - expected;
      const costPrice = Number(ordered[0].product?.costPrice ?? 0);
      const varianceValue = variance === null ? null : variance * costPrice;
      const countedBy = [...new Set(countedRows.map((r: any) => r.countedBy).filter(Boolean))];

      const { costPrice: _cost, ...safeProduct } = ordered[0].product ?? {};
      products.push({
        productId,
        product: safeProduct,
        snapshot,
        expected,
        physical,
        breakdown,
        variance,
        varianceValue,
        movementTotal,
        movements: movs.map((m: any) => ({
          id: m.id,
          movementType: m.movementType,
          quantityChange: m.quantityChange?.toString?.() ?? m.quantityChange,
          referenceType: m.referenceType ?? null,
          referenceId: m.referenceId ?? null,
          createdAt: m.createdAt,
        })),
        countedBy,
        rows: rows.map((r: any) => ({
          itemId: r.id,
          condition: r.condition ?? 'good',
          physicalQuantity: r.physicalQuantity === null || r.physicalQuantity === undefined
            ? null
            : r.physicalQuantity.toString(),
          countedBy: r.countedBy ?? null,
        })),
      });
    }

    const selisih = products.filter((p) => p.variance !== null && p.variance !== 0);
    const cocok = products.filter((p) => p.variance === 0);
    const belumDihitung = products.filter((p) => p.variance === null);
    const review = {
      id: opname.id,
      opnameNumber: opname.opnameNumber,
      code: opname.code,
      opnameType: opname.opnameType,
      status: opname.status,
      warehouseId: opname.warehouseId,
      branch: opname.branch,
      opnameDate: opname.opnameDate,
      summary: {
        products: products.length,
        countedProducts: selisih.length + cocok.length,
        selisih: selisih.length,
        cocok: cocok.length,
        belumDihitung: belumDihitung.length,
        totalVarianceValue: selisih.reduce((s, p) => s + (p.varianceValue ?? 0), 0),
        movementCount: (opname.movements ?? []).length,
      },
      selisih,
      cocok,
      belumDihitung,
    };
    return this.canSeeVariance(viewer?.roles) ? review : this.stripBlindReview(review);
  }

  /** IGDERP-235 (OP3): review without system/expected/variance for counters. */
  private stripBlindReview(review: any) {
    const stripProduct = (p: any) => {
      const { snapshot, expected, variance, varianceValue, movementTotal, movements, ...rest } = p;
      return rest;
    };
    const { totalVarianceValue, movementCount, ...safeSummary } = review.summary;
    return {
      ...review,
      summary: safeSummary,
      selisih: review.selisih.map(stripProduct),
      cocok: review.cocok.map(stripProduct),
      belumDihitung: review.belumDihitung.map(stripProduct),
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

    // IGDERP-235 (OP3): OPEN sessions show Expected (= snapshot + movements)
    // alongside system/physical so the sheet matches the C2 review math.
    let expectedByProduct: Map<string, number> | null = null;
    if (opname.opnameType === 'OPEN') {
      const review: any = await this.getReview(id);
      expectedByProduct = new Map(
        [...review.selisih, ...review.cocok, ...review.belumDihitung].map((p: any) => [p.productId, p.expected]),
      );
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ORBIT';
    const ws = wb.addWorksheet('Hasil Opname');

    ws.columns = [
      { header: 'Produk', key: 'product', width: 32 },
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Barcode', key: 'barcode', width: 20 },
      { header: 'Stok Sistem', key: 'system', width: 13 },
      ...(expectedByProduct ? [{ header: 'Expected', key: 'expected', width: 13 }] : []),
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
        ...(expectedByProduct ? { expected: expectedByProduct.get(item.productId) ?? null } : {}),
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
      where: { opnameId, productId, deletedAt: null },
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
      where: { id: itemId, opnameId, deletedAt: null },
    });
    if (!item) {
      throw new NotFoundException('Opname item not found');
    }

    // IGDERP-236 (OP4): no hard delete on opname data — counted rows are
    // preserved (use a correction with reason instead); only uncounted
    // placeholder rows may be removed, and only as a soft delete.
    if (item.physicalQuantity !== null && item.physicalQuantity !== undefined) {
      throw new BadRequestException(
        'Baris yang sudah dihitung tidak bisa dihapus — gunakan koreksi dengan alasan',
      );
    }

    await this.prisma.stockOpnameItem.update({
      where: { id: item.id },
      data: { deletedAt: new Date() },
    });

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
    // Cancellable = anything not yet terminal. Deliberately NOT assertActive:
    // a 'completed' (counted, unapproved) session must be cancellable too,
    // otherwise it blocks the outlet forever with no escape.
    if (!['draft', 'counting', 'completed'].includes(opname.status)) {
      throw new BadRequestException(
        `Cannot cancel for opname with status: ${opname.status}`,
      );
    }

    return this.prisma.stockOpname.update({
      where: { id: opnameId },
      data: {
        status: 'cancelled',
        cancelledBy: userId,
        cancelledAt: new Date(),
      },
      include: {
        items: {
          where: { deletedAt: null },
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
          where: { deletedAt: null },
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

        // IGDERP-236 (OP4): overwriting a counted row is a correction —
        // it needs force plus a mandatory reason (append-only history).
        const wasCounted =
          !!opnameItem &&
          opnameItem.physicalQuantity !== null &&
          opnameItem.physicalQuantity !== undefined;
        if (opnameItem && wasCounted && !item.force) {
          // Scan-flow double-submit guard. Explicit corrections (table edit
          // via Draft SO) send force:true and overwrite instead.
          throw new ConflictException(
            `Product ${item.productId} already counted${cond ? ` with condition ${cond}` : ''}`,
          );
        }
        if (opnameItem && wasCounted && item.force && !item.correctionReason?.trim()) {
          throw new BadRequestException(
            `Product ${item.productId} is already counted — a correction reason is required`,
          );
        }
        const correctionOld = wasCounted && item.force ? Number(opnameItem.physicalQuantity) : null;

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
        // IGDERP-236 (OP4): correction history — old/new preserved, never overwritten.
        if (correctionOld !== null) {
          await tx.opnameCorrection.create({
            data: {
              opnameId,
              productId: item.productId,
              condition: item.condition ?? null,
              oldQuantity: new Decimal(correctionOld),
              newQuantity: new Decimal(physicalQuantity),
              reason: item.correctionReason!.trim(),
              correctedBy: userId,
            },
          });
        }
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
        items: { where: { deletedAt: null } },
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
          where: { deletedAt: null },
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
  async approveOpname(opnameId: string, userId: string, userRoles?: string[], note?: string) {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
      include: {
        items: {
          where: { deletedAt: null },
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

    // IGDERP-236 (OP4): approver enforcement — the assigned approver (or an
    // OWNER/SUPERADMIN override) approves. Sessions without any resolvable
    // approver keep the legacy SPV/CSO role gate from the controller.
    const assignedApprover = opname.approverId ?? (await this.resolveOutletApprover(opname.branchId));
    const isSuper = (userRoles ?? []).some((r) => r === 'OWNER' || r === 'SUPERADMIN');
    if (assignedApprover && userId !== assignedApprover && !isSuper) {
      throw new ForbiddenException('Hanya approver yang ditetapkan untuk sesi ini yang dapat menyetujui');
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
      // IGDERP-236 (OP4): append-only approval log — stock moves only here.
      await tx.opnameApproval.create({
        data: {
          opnameId,
          approverId: userId,
          decision: 'APPROVED',
          note: note ?? null,
        },
      });
      return tx.stockOpname.update({
        where: { id: opnameId },
        data: {
          status: 'approved',
          approvedBy: userId,
          approvedAt: new Date(),
        },
        include: {
          items: {
            where: { deletedAt: null },
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
