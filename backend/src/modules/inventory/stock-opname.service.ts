import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { StartOpnameDto } from './dto/start-opname.dto';
import { RecordCountDto } from './dto/record-count.dto';
import { Decimal } from '@prisma/client/runtime/library';

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

  async startOpname(dto: StartOpnameDto, userId: string) {
    const { branchId, opnameDate, notes } = dto;

    // Validate branch
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Check if there's an active opname (draft or counting)
    const activeOpname = await this.prisma.stockOpname.findFirst({
      where: {
        branchId,
        status: {
          in: ['draft', 'counting'],
        },
      },
    });

    if (activeOpname) {
      throw new BadRequestException(
        `There is an active opname (${activeOpname.opnameNumber}) for this branch. Please complete or cancel it first.`,
      );
    }

    // Get all products with stock in this branch
    const stocks = await this.prisma.productStock.findMany({
      where: {
        branchId,
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
          branchId,
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

    return this.prisma.stockOpname.findMany({
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

    return opname;
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

        await tx.stockOpnameItem.update({
          where: { id: opnameItem.id },
          data: {
            physicalQuantity: new Decimal(physicalQuantity),
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

    // Check for large discrepancies (>5%)
    const itemsWithLargeDiscrepancy = opname.items.filter((item) => {
      const systemQty = Number(item.systemQuantity);
      const discrepancy = Number(item.discrepancy || 0);
      const percentage = systemQty > 0 ? Math.abs((discrepancy / systemQty) * 100) : 0;
      return percentage > 5;
    });

    if (itemsWithLargeDiscrepancy.length > 0) {
      // Log warning but allow completion
      // In production, you might want to require additional approval
    }

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
      // Create stock adjustments for discrepancies
      for (const item of opname.items) {
        const discrepancy = Number(item.discrepancy || 0);

        if (discrepancy !== 0) {
          // Get current stock
          let stock = await tx.productStock.findUnique({
            where: {
              productId_branchId: {
                productId: item.productId,
                branchId: opname.branchId,
              },
            },
          });

          if (!stock) {
            stock = await tx.productStock.create({
              data: {
                productId: item.productId,
                branchId: opname.branchId,
                quantityAvailable: new Decimal(0),
                quantityReserved: new Decimal(0),
                quantityDamaged: new Decimal(0),
              },
            });
          }

          const quantityBefore = Number(stock.quantityAvailable);
          const physicalQuantity = Number(item.physicalQuantity!);
          const quantityAfter = physicalQuantity; // Set to physical count

          // Update stock to match physical count
          await tx.productStock.update({
            where: {
              productId_branchId: {
                productId: item.productId,
                branchId: opname.branchId,
              },
            },
            data: {
              quantityAvailable: new Decimal(quantityAfter),
              quantityDamaged:
                item.condition === 'damaged'
                  ? new Decimal(Number(stock.quantityDamaged) + (item.condition === 'damaged' ? Math.abs(discrepancy) : 0))
                  : stock.quantityDamaged,
            },
          });

          // Create stock movement
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              branchId: opname.branchId,
              movementType: 'ADJUSTMENT',
              referenceType: 'OPNAME',
              referenceId: opnameId,
              quantityChange: new Decimal(discrepancy),
              quantityBefore: new Decimal(quantityBefore),
              quantityAfter: new Decimal(quantityAfter),
              notes: `Stock opname adjustment${item.notes ? ` - ${item.notes}` : ''}`,
              createdBy: userId,
            },
          });
        }
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

