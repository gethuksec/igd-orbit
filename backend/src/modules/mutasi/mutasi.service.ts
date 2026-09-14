import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateMutasiDto } from './dto/create-mutasi.dto';
import {
  TransferStockItemDto,
} from '../transfer-stock/dto/create-transfer-stock.dto';
import { Decimal } from '@prisma/client/runtime/library';

interface MergedLine {
  productId: string;
  quantity: number;
}

type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  scope: string;
  outletId: string | null;
  isActive: boolean;
};

/**
 * Mutasi (IGDERP-140) — CENTRAL ↔ OUTLET + OUTLET ↔ OUTLET movement.
 *
 * Executed by SODO (purchasing team) under permission key `inventory.mutasi`.
 * Same contract as Transfer Stock v1 (IGDERP-78): quantity-only, atomic
 * OUT/IN, StockMovement rows, no GL/cash/sales/purchase transaction.
 *
 * Valid combinations:
 *  - SYSTEM (GOOD|BAD — central-good / central-bad) ↔ OUTLET/GOOD — either direction
 *  - OUTLET/GOOD ↔ OUTLET/GOOD — only when the outlets differ
 * Rejected: same warehouse, SYSTEM ↔ SYSTEM, OUTLET ↔ OUTLET of one outlet
 * (intra-outlet same-outlet moves are Transfer Stock, IGDERP-139).
 */
@Injectable()
export class MutasiService {
  constructor(private prisma: PrismaService) {}

  private generateDocumentNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `MUT-${dateStr}-${random}`;
  }

  /**
   * Merge duplicate product lines: sum quantity.
   */
  private mergeItems(items: TransferStockItemDto[]): MergedLine[] {
    const merged = new Map<string, MergedLine>();
    for (const item of items) {
      const existing = merged.get(item.productId);
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        merged.set(item.productId, {
          productId: item.productId,
          quantity: item.quantity,
        });
      }
    }
    return Array.from(merged.values());
  }

  private isValidMoveWarehouse(w: WarehouseRow): boolean {
    // Outlet GOOD warehouses and system-scoped central warehouses are both
    // valid move endpoints; outlet BAD warehouses are not part of the model.
    if (!w.isActive) return false;
    if (w.scope === 'SYSTEM') return w.type === 'GOOD' || w.type === 'BAD';
    return w.type === 'GOOD' && !!w.outletId;
  }

  /**
   * Validate the pair (from/to) against the Mutasi rules.
   */
  private validatePair(from: WarehouseRow, to: WarehouseRow) {
    if (from.id === to.id) {
      throw new BadRequestException(
        'Source and destination warehouse must differ',
      );
    }
    if (from.scope === 'SYSTEM' && to.scope === 'SYSTEM') {
      throw new BadRequestException(
        'Central-to-central moves are not allowed; use central ↔ outlet only',
      );
    }
    if (from.scope === 'OUTLET' && to.scope === 'OUTLET') {
      if (from.outletId === to.outletId) {
        throw new BadRequestException(
          'Same-outlet moves are Transfer Stock (IGDERP-139), not Mutasi',
        );
      }
    }
  }

  private async resolveWarehouse(id: string, label: string): Promise<WarehouseRow> {
    const wh = await this.prisma.warehouse.findUnique({ where: { id } });
    if (!wh) {
      throw new NotFoundException(`${label} warehouse not found`);
    }
    if (!this.isValidMoveWarehouse(wh)) {
      throw new BadRequestException(
        `${label} warehouse is not a valid move endpoint (outlet GOOD or system central warehouse)`,
      );
    }
    return wh;
  }

  /**
   * IGDERP-173 — create a PENDING Mutasi document (transit → receive).
   * No stock moves at creation: source decrements at send(), destination
   * increments at receive(). Historical docs keep status 'completed'.
   * Same validation + snapshots as before; items carry quantityRequested
   * only (sent/received are filled by send()/receive()).
   * No GL / cash / sales / purchase / finance transaction is created.
   */
  async create(dto: CreateMutasiDto, userId: string) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one product line is required');
    }

    const fromWarehouse = await this.resolveWarehouse(
      dto.fromWarehouseId,
      'Source',
    );
    const toWarehouse = await this.resolveWarehouse(dto.toWarehouseId, 'Destination');
    this.validatePair(fromWarehouse, toWarehouse);

    const lines = this.mergeItems(dto.items);

    // ── Products + snapshots ──
    const productIds = lines.map((l) => l.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const resolvedLines = lines.map((line) => {
      const product = productMap.get(line.productId);
      if (!product) {
        throw new NotFoundException(`Product ${line.productId} not found`);
      }
      return {
        productId: line.productId,
        productName: product.name,
        productSku: product.sku,
        quantity: line.quantity,
      };
    });

    const documentNumber = this.generateDocumentNumber();

    return await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          transferNumber: documentNumber,
          fromWarehouseId: fromWarehouse.id,
          toWarehouseId: toWarehouse.id,
          fromBranchId: fromWarehouse.outletId,
          toBranchId: toWarehouse.outletId,
          transferType: 'mutasi',
          status: 'pending',
          requestedBy: userId,
          notes: dto.notes,
          items: {
            create: resolvedLines.map((line) => ({
              productId: line.productId,
              productName: line.productName,
              productSku: line.productSku,
              quantityRequested: new Decimal(line.quantity),
            })),
          },
        },
        include: { items: true },
      });

      const doc = await tx.stockTransfer.findUnique({
        where: { id: transfer.id },
        include: {
          items: { include: { product: true } },
          fromWarehouse: true,
          toWarehouse: true,
          fromBranch: true,
          toBranch: true,
        },
      });
      return this.serialize(doc);
    });
  }

  /**
   * IGDERP-173 — shared atomic OUT→IN leg used by send() (source OUT),
   * receive() (destination IN) and the damage booking. Moves `qty` of
   * available stock from one warehouse to another with StockMovement rows.
   */
  private async moveAvailable(
    tx: any,
    args: {
      productId: string;
      productName: string;
      qty: number;
      fromWarehouse: WarehouseRow;
      toWarehouse: WarehouseRow;
      referenceType: string;
      referenceId: string;
      note: string;
      userId: string;
    },
  ) {
    const { productId, productName, qty, fromWarehouse, toWarehouse } = args;
    if (qty <= 0) return;

    const srcStock = await tx.productStock.findUnique({
      where: {
        productId_warehouseId: { productId, warehouseId: fromWarehouse.id },
      },
    });
    const srcBefore = srcStock ? Number(srcStock.quantityAvailable) : 0;
    if (!srcStock || srcBefore < qty) {
      throw new BadRequestException(
        `Insufficient stock for "${productName}" at ${fromWarehouse.name} (available: ${srcBefore}, needed: ${qty})`,
      );
    }
    const srcAfter = srcBefore - qty;
    await tx.productStock.update({
      where: {
        productId_warehouseId: { productId, warehouseId: fromWarehouse.id },
      },
      data: { quantityAvailable: new Decimal(srcAfter) },
    });
    await tx.stockMovement.create({
      data: {
        productId,
        warehouseId: fromWarehouse.id,
        branchId: fromWarehouse.outletId,
        movementType: 'OUT',
        referenceType: args.referenceType,
        referenceId: args.referenceId,
        quantityChange: new Decimal(-qty),
        quantityBefore: new Decimal(srcBefore),
        quantityAfter: new Decimal(srcAfter),
        notes: args.note,
        createdBy: args.userId,
      },
    });

    const dstStock = await tx.productStock.findUnique({
      where: {
        productId_warehouseId: { productId, warehouseId: toWarehouse.id },
      },
    });
    const dstBefore = dstStock ? Number(dstStock.quantityAvailable) : 0;
    const dstAfter = dstBefore + qty;
    if (dstStock) {
      await tx.productStock.update({
        where: {
          productId_warehouseId: { productId, warehouseId: toWarehouse.id },
        },
        data: { quantityAvailable: new Decimal(dstAfter) },
      });
    } else {
      await tx.productStock.create({
        data: {
          productId,
          warehouseId: toWarehouse.id,
          branchId: toWarehouse.outletId,
          quantityAvailable: new Decimal(dstAfter),
          quantityReserved: new Decimal(0),
          quantityDamaged: new Decimal(0),
        },
      });
    }
    await tx.stockMovement.create({
      data: {
        productId,
        warehouseId: toWarehouse.id,
        branchId: toWarehouse.outletId,
        movementType: 'IN',
        referenceType: args.referenceType,
        referenceId: args.referenceId,
        quantityChange: new Decimal(qty),
        quantityBefore: new Decimal(dstBefore),
        quantityAfter: new Decimal(dstAfter),
        notes: args.note,
        createdBy: args.userId,
      },
    });
  }

  private async loadMutasiDoc(id: string) {
    const doc: any = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        fromWarehouse: true,
        toWarehouse: true,
        fromBranch: true,
        toBranch: true,
      },
    });
    if (!doc || doc.transferType !== 'mutasi') {
      throw new NotFoundException('Mutasi document not found');
    }
    return doc;
  }

  /**
   * IGDERP-173 — send (pending → sent). Goods leave the source now;
   * quantitySent defaults to requested and may be lowered per line.
   */
  async send(id: string, dto: { items?: Array<{ itemId: string; quantitySent?: number }> }, userId: string) {
    const doc = await this.loadMutasiDoc(id);
    if (doc.status !== 'pending') {
      throw new BadRequestException(`Only pending documents can be sent (status: ${doc.status})`);
    }
    const overrides = new Map((dto.items || []).map((l) => [l.itemId, l.quantitySent]));

    return await this.prisma.$transaction(async (tx) => {
      for (const item of doc.items) {
        const requested = Number(item.quantityRequested);
        let sent = overrides.has(item.id) ? Number(overrides.get(item.id)) : requested;
        if (!Number.isFinite(sent) || sent < 0 || sent > requested) {
          throw new BadRequestException(
            `quantitySent for "${item.productName || item.productId}" must be between 0 and ${requested}`,
          );
        }
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: { quantitySent: new Decimal(sent) },
        });
        // Source OUT now; destination IN happens at receive(). The sent
        // units are physically in transit between the two legs.
        const srcStock = await tx.productStock.findUnique({
          where: {
            productId_warehouseId: { productId: item.productId, warehouseId: doc.fromWarehouseId },
          },
        });
        const srcBefore = srcStock ? Number(srcStock.quantityAvailable) : 0;
        if (sent > 0 && (!srcStock || srcBefore < sent)) {
          throw new BadRequestException(
            `Insufficient stock for "${item.productName || item.productId}" at ${doc.fromWarehouse.name} (available: ${srcBefore}, needed: ${sent})`,
          );
        }
        if (sent > 0) {
          const srcAfter = srcBefore - sent;
          await tx.productStock.update({
            where: {
              productId_warehouseId: { productId: item.productId, warehouseId: doc.fromWarehouseId },
            },
            data: { quantityAvailable: new Decimal(srcAfter) },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              warehouseId: doc.fromWarehouseId,
              branchId: doc.fromBranchId,
              movementType: 'OUT',
              referenceType: 'TRANSFER',
              referenceId: doc.id,
              quantityChange: new Decimal(-sent),
              quantityBefore: new Decimal(srcBefore),
              quantityAfter: new Decimal(srcAfter),
              notes: `Mutasi terkirim: ${doc.transferNumber} - ${doc.fromWarehouse.name} → ${doc.toWarehouse.name}`,
              createdBy: userId,
            },
          });
        }
      }
      await tx.stockTransfer.update({
        where: { id: doc.id },
        data: { status: 'sent', sentBy: userId, sentAt: new Date() },
      });
      const updated = await tx.stockTransfer.findUnique({
        where: { id: doc.id },
        include: {
          items: { include: { product: true } },
          fromWarehouse: true,
          toWarehouse: true,
          fromBranch: true,
          toBranch: true,
        },
      });
      return this.serialize(updated);
    });
  }

  /**
   * IGDERP-173 — receive (sent → received, GR-mirror). Per line:
   * received + damage must equal sent — every missing unit is booked to
   * bad stock via an auto-created completed SODO mutasi
   * (destination GOOD → central BAD) carrying the WA photo reference.
   */
  async receive(
    id: string,
    dto: {
      items: Array<{
        itemId: string;
        quantityReceived: number;
        damageQuantity?: number;
        damagePhotoUrl?: string;
        damageNotes?: string;
      }>;
    },
    userId: string,
  ) {
    const doc = await this.loadMutasiDoc(id);
    if (doc.status !== 'sent') {
      throw new BadRequestException(`Only sent documents can be received (status: ${doc.status})`);
    }
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Receive lines are required');
    }
    const byId = new Map(dto.items.map((l) => [l.itemId, l]));
    if (byId.size !== doc.items.length) {
      throw new BadRequestException('Receive must cover every line of the document');
    }

    const centralBad = await this.prisma.warehouse.findFirst({
      where: { scope: 'SYSTEM', type: 'BAD', isActive: true },
    });
    const needsBad = dto.items.some((l) => Number(l.damageQuantity || 0) > 0);
    if (needsBad && !centralBad) {
      throw new BadRequestException('Central Bad Stock warehouse is not configured');
    }

    return await this.prisma.$transaction(async (tx) => {
      const damageDocLines: any[] = [];
      for (const item of doc.items) {
        const line = byId.get(item.id);
        const sent = Number(item.quantitySent ?? 0);
        const received = Number(line!.quantityReceived);
        const damage = Number(line!.damageQuantity || 0);
        if (!Number.isFinite(received) || received < 0 || received > sent) {
          throw new BadRequestException(
            `quantityReceived for "${item.productName || item.productId}" must be between 0 and ${sent}`,
          );
        }
        if (!Number.isFinite(damage) || damage < 0 || damage > sent) {
          throw new BadRequestException(
            `damageQuantity for "${item.productName || item.productId}" must be between 0 and ${sent}`,
          );
        }
        if (received + damage !== sent) {
          throw new BadRequestException(
            `Line "${item.productName || item.productId}": received (${received}) + damage (${damage}) must equal sent (${sent})`,
          );
        }

        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: {
            quantityReceived: new Decimal(received),
            notes: [
              item.notes,
              line!.damageNotes ? `Rusak: ${line!.damageNotes}` : null,
              line!.damagePhotoUrl ? `Foto: ${line!.damagePhotoUrl}` : null,
            ]
              .filter(Boolean)
              .join(' | ') || null,
          },
        });

        // Destination IN: good units stay, damaged units arrive broken and
        // are immediately re-booked to bad stock below (net += received).
        const arrived = received + damage;
        if (arrived > 0) {
          const dstStock = await tx.productStock.findUnique({
            where: {
              productId_warehouseId: { productId: item.productId, warehouseId: doc.toWarehouseId },
            },
          });
          const dstBefore = dstStock ? Number(dstStock.quantityAvailable) : 0;
          const dstAfter = dstBefore + arrived;
          if (dstStock) {
            await tx.productStock.update({
              where: {
                productId_warehouseId: { productId: item.productId, warehouseId: doc.toWarehouseId },
              },
              data: { quantityAvailable: new Decimal(dstAfter) },
            });
          } else {
            await tx.productStock.create({
              data: {
                productId: item.productId,
                warehouseId: doc.toWarehouseId,
                branchId: doc.toBranchId,
                quantityAvailable: new Decimal(dstAfter),
                quantityReserved: new Decimal(0),
                quantityDamaged: new Decimal(0),
              },
            });
          }
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              warehouseId: doc.toWarehouseId,
              branchId: doc.toBranchId,
              movementType: 'IN',
              referenceType: 'TRANSFER',
              referenceId: doc.id,
              quantityChange: new Decimal(arrived),
              quantityBefore: new Decimal(dstBefore),
              quantityAfter: new Decimal(dstAfter),
              notes: `Mutasi diterima: ${doc.transferNumber} - ${doc.fromWarehouse.name} → ${doc.toWarehouse.name}`,
              createdBy: userId,
            },
          });
        }

        if (damage > 0) {
          damageDocLines.push({
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            quantity: damage,
            photoUrl: line!.damagePhotoUrl,
            notes: line!.damageNotes,
          });
        }
      }

      // Auto-created SODO damage mutasi: destination GOOD → central BAD.
      if (damageDocLines.length > 0) {
        const damageNumber = this.generateDocumentNumber();
        const damageDoc = await tx.stockTransfer.create({
          data: {
            transferNumber: damageNumber,
            fromWarehouseId: doc.toWarehouseId,
            toWarehouseId: centralBad!.id,
            fromBranchId: doc.toBranchId,
            toBranchId: centralBad!.outletId,
            transferType: 'mutasi',
            status: 'completed',
            requestedBy: userId,
            notes: `Rusak dari ${doc.transferNumber}${damageDocLines[0]?.photoUrl ? ` · Foto: ${damageDocLines.map((l) => l.photoUrl).filter(Boolean).join(', ')}` : ''}`,
            items: {
              create: damageDocLines.map((l) => ({
                productId: l.productId,
                productName: l.productName,
                productSku: l.productSku,
                quantityRequested: new Decimal(l.quantity),
                quantitySent: new Decimal(l.quantity),
                quantityReceived: new Decimal(l.quantity),
              })),
            },
          },
          include: { items: true },
        });
        for (const l of damageDocLines) {
          await this.moveAvailable(tx, {
            productId: l.productId,
            productName: l.productName || l.productId,
            qty: l.quantity,
            fromWarehouse: {
              id: doc.toWarehouseId,
              code: doc.toWarehouse.code,
              name: doc.toWarehouse.name,
              type: doc.toWarehouse.type,
              scope: doc.toWarehouse.scope,
              outletId: doc.toBranchId,
              isActive: true,
            },
            toWarehouse: {
              id: centralBad!.id,
              code: centralBad!.code,
              name: centralBad!.name,
              type: centralBad!.type,
              scope: centralBad!.scope,
              outletId: centralBad!.outletId,
              isActive: true,
            },
            referenceType: 'TRANSFER',
            referenceId: damageDoc.id,
            note: `Mutasi rusak: ${damageNumber} (dari ${doc.transferNumber})${l.photoUrl ? ` · Foto: ${l.photoUrl}` : ''}${l.notes ? ` · ${l.notes}` : ''}`,
            userId,
          });
        }
      }

      await tx.stockTransfer.update({
        where: { id: doc.id },
        data: { status: 'received', receivedBy: userId, receivedAt: new Date() },
      });
      const updated = await tx.stockTransfer.findUnique({
        where: { id: doc.id },
        include: {
          items: { include: { product: true } },
          fromWarehouse: true,
          toWarehouse: true,
          fromBranch: true,
          toBranch: true,
        },
      });
      return this.serialize(updated);
    });
  }

  /**
   * IGDERP-173 — cancel. Pending docs reverse nothing; sent docs return
   * the in-transit units to the source. Received docs are final.
   */
  async cancel(id: string, userId: string) {
    const doc = await this.loadMutasiDoc(id);
    if (doc.status !== 'pending' && doc.status !== 'sent') {
      throw new BadRequestException(`Only pending/sent documents can be cancelled (status: ${doc.status})`);
    }

    return await this.prisma.$transaction(async (tx) => {
      if (doc.status === 'sent') {
        for (const item of doc.items) {
          const sent = Number(item.quantitySent ?? 0);
          if (sent <= 0) continue;
          const srcStock = await tx.productStock.findUnique({
            where: {
              productId_warehouseId: { productId: item.productId, warehouseId: doc.fromWarehouseId },
            },
          });
          const srcBefore = srcStock ? Number(srcStock.quantityAvailable) : 0;
          const srcAfter = srcBefore + sent;
          if (srcStock) {
            await tx.productStock.update({
              where: {
                productId_warehouseId: { productId: item.productId, warehouseId: doc.fromWarehouseId },
              },
              data: { quantityAvailable: new Decimal(srcAfter) },
            });
          } else {
            await tx.productStock.create({
              data: {
                productId: item.productId,
                warehouseId: doc.fromWarehouseId,
                branchId: doc.fromBranchId,
                quantityAvailable: new Decimal(srcAfter),
                quantityReserved: new Decimal(0),
                quantityDamaged: new Decimal(0),
              },
            });
          }
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              warehouseId: doc.fromWarehouseId,
              branchId: doc.fromBranchId,
              movementType: 'IN',
              referenceType: 'TRANSFER',
              referenceId: doc.id,
              quantityChange: new Decimal(sent),
              quantityBefore: new Decimal(srcBefore),
              quantityAfter: new Decimal(srcAfter),
              notes: `Mutasi dibatalkan: ${doc.transferNumber} — kembali ke ${doc.fromWarehouse.name}`,
              createdBy: userId,
            },
          });
        }
      }
      await tx.stockTransfer.update({
        where: { id: doc.id },
        data: { status: 'cancelled' },
      });
      const updated = await tx.stockTransfer.findUnique({
        where: { id: doc.id },
        include: {
          items: { include: { product: true } },
          fromWarehouse: true,
          toWarehouse: true,
          fromBranch: true,
          toBranch: true,
        },
      });
      return this.serialize(updated);
    });
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    outletId?: string;
    warehouseId?: string;
    status?: string;
  }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
    const skip = (page - 1) * limit;

    const where: any = { transferType: 'mutasi' };
    if (query.status) {
      where.status = query.status;
    }
    if (query.outletId) {
      where.OR = [{ fromBranchId: query.outletId }, { toBranchId: query.outletId }];
    }
    if (query.warehouseId) {
      where.OR = [
        ...(where.OR || []),
        { fromWarehouseId: query.warehouseId },
        { toWarehouseId: query.warehouseId },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        where,
        include: {
          items: { include: { product: true } },
          fromWarehouse: true,
          toWarehouse: true,
          fromBranch: true,
          toBranch: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    const requestedBys = Array.from(
      new Set(data.map((d) => d.requestedBy).filter(Boolean)),
    );
    const users = requestedBys.length
      ? await this.prisma.user.findMany({
          where: { id: { in: requestedBys } },
          select: { id: true, fullName: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.fullName]));

    return {
      data: data.map((doc) => ({
        ...this.serialize(doc),
        picName: doc.requestedBy ? userMap.get(doc.requestedBy) || null : null,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const doc = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        fromWarehouse: true,
        toWarehouse: true,
        fromBranch: true,
        toBranch: true,
      },
    });
    if (!doc || doc.transferType !== 'mutasi') {
      throw new NotFoundException('Mutasi document not found');
    }

    let picName: string | null = null;
    if (doc.requestedBy) {
      const user = await this.prisma.user.findUnique({
        where: { id: doc.requestedBy },
        select: { id: true, fullName: true },
      });
      picName = user?.fullName || null;
    }

    return { ...this.serialize(doc), picName };
  }

  private serialize(doc: any) {
    return {
      ...doc,
      items: (doc.items || []).map((item: any) => ({
        ...item,
        quantityRequested: Number(item.quantityRequested),
        quantitySent: item.quantitySent !== null ? Number(item.quantitySent) : null,
        quantityReceived:
          item.quantityReceived !== null ? Number(item.quantityReceived) : null,
      })),
    };
  }

  // ── Supporting lists for the Mutasi form ──

  /**
   * All active move-endpoint warehouses: system central warehouses
   * (central-good / central-bad) + outlet GOOD warehouses, each carrying its
   * outlet info so the UI can group/sort them (central first, then per outlet).
   */
  async findWarehouses() {
    return this.prisma.warehouse.findMany({
      where: {
        isActive: true,
        OR: [
          { scope: 'SYSTEM' },
          { type: 'GOOD', scope: 'OUTLET' },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        scope: true,
        outletId: true,
        outlet: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ scope: 'asc' }, { type: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * IGDERP-173 (§2): destination availability per line for the create form
   * ("form mutasi menampilkan stok asal + stok tujuan").
   */
  async findDestinationStock(warehouseId: string, productIds: string[]) {
    const warehouse = await this.prisma.warehouse.findUnique({
      where: { id: warehouseId },
    });
    if (!warehouse || !this.isValidMoveWarehouse(warehouse as WarehouseRow)) {
      throw new BadRequestException('Destination warehouse is not a valid move endpoint');
    }
    if (!productIds || productIds.length === 0) {
      return [];
    }
    const stocks = await this.prisma.productStock.findMany({
      where: { warehouseId, productId: { in: productIds } },
      select: { productId: true, quantityAvailable: true },
    });
    const stockMap = new Map(
      stocks.map((s) => [s.productId, Number(s.quantityAvailable)]),
    );
    return productIds.map((productId) => ({
      productId,
      availableQuantity: stockMap.get(productId) ?? 0,
    }));
  }

  /**
   * Product search for the line picker, with available quantity in the
   * selected source warehouse.
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
      availableQuantity: stockMap.get(p.id) ?? 0,
    }));
  }
}
