import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { StartOpnameDto } from './dto/start-opname.dto';
import { RecordCountDto } from './dto/record-count.dto';
import { Decimal } from '@prisma/client/runtime/library';

const ACTIVE_STATUSES = ['draft', 'counting'] as const;

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

  async startOpname(dto: StartOpnameDto, userId: string) {
    const { warehouseId, branchId: legacyBranchId, opnameDate, notes } = dto;

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

    // Get all products with stock in this warehouse
    const stocks = await this.prisma.productStock.findMany({
      where: {
        warehouseId: warehouse.id,
        product: {
          isActive: true,
          deletedAt: null,
        },
      },
      include: {
        product: true,
      },
    });

    // Create opname with items
    return await this.prisma.$transaction(async (tx) => {
      const opname = await tx.stockOpname.create({
        data: {
          opnameNumber: this.generateOpnameNumber(),
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

  async findAll(branchId?: string, status?: string) {
    const where: any = {};

    if (branchId) {
      where.branchId = branchId;
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

    return Promise.all(opnames.map((o) => this.attachLiveQuantities(o)));
  }

  async findById(id: string) {
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

    return this.attachLiveQuantities(opname);
  }

  /** Draft model: add a product to an ongoing (draft/counting) opname. */
  async addItem(opnameId: string, productId: string) {
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

    return this.findById(opnameId);
  }

  /** Draft model: remove a product from an ongoing (draft/counting) opname. */
  async removeItem(opnameId: string, productId: string) {
    const opname = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
    });

    if (!opname) {
      throw new NotFoundException('Opname not found');
    }
    this.assertActive(opname, 'remove items from');

    const item = await this.prisma.stockOpnameItem.findFirst({
      where: { opnameId, productId },
    });
    if (!item) {
      throw new NotFoundException('Product not found in opname items');
    }

    await this.prisma.stockOpnameItem.delete({ where: { id: item.id } });

    return this.findById(opnameId);
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

  async recordCount(opnameId: string, dto: RecordCountDto, userId: string) {
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
      // Update each item
      for (const item of dto.items) {
        const opnameItem = opname.items.find((i) => i.productId === item.productId);

        if (!opnameItem) {
          throw new NotFoundException(`Product ${item.productId} not found in opname items`);
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
      }

      return tx.stockOpname.findUnique({
        where: { id: opnameId },
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
