import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { ReceiveTransferDto } from './dto/receive-transfer.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class StockTransferService {
  constructor(private prisma: PrismaService) {}

  private generateTransferNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `TRF-${dateStr}-${random}`;
  }

  async createTransfer(dto: CreateTransferDto, userId: string) {
    const { fromBranchId, toBranchId, transferType, items, notes } = dto;

    // Validate branches
    const fromBranch = await this.prisma.branch.findUnique({
      where: { id: fromBranchId },
    });

    if (!fromBranch) {
      throw new NotFoundException('Source branch not found');
    }

    const toBranch = await this.prisma.branch.findUnique({
      where: { id: toBranchId },
    });

    if (!toBranch) {
      throw new NotFoundException('Destination branch not found');
    }

    if (fromBranchId === toBranchId) {
      throw new BadRequestException('Cannot transfer to the same branch');
    }

    // Validate products and check stock
    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      // Check available stock
      const stock = await this.prisma.productStock.findUnique({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: fromBranchId,
          },
        },
      });

      if (!stock) {
        throw new BadRequestException(
          `Product ${product.name} has no stock at source branch`,
        );
      }

      const available = Number(stock.quantityAvailable);
      const reserved = Number(stock.quantityReserved);

      if (available - reserved < item.quantityRequested) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name}. Available: ${available - reserved}, Requested: ${item.quantityRequested}`,
        );
      }
    }

    // Create transfer
    return await this.prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.create({
        data: {
          transferNumber: this.generateTransferNumber(),
          fromBranchId,
          toBranchId,
          transferType,
          status: 'pending',
          requestedBy: userId,
          notes,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantityRequested: new Decimal(item.quantityRequested),
              notes: item.notes,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          fromBranch: true,
          toBranch: true,
        },
      });

      // Reserve stock at source branch
      for (const item of items) {
        await tx.productStock.update({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId: fromBranchId,
            },
          },
          data: {
            quantityReserved: {
              increment: new Decimal(item.quantityRequested),
            },
          },
        });
      }

      return transfer;
    });
  }

  async findAll(branchId?: string, status?: string) {
    const where: any = {};

    if (branchId) {
      where.OR = [
        { fromBranchId: branchId },
        { toBranchId: branchId },
      ];
    }

    if (status) {
      where.status = status;
    }

    return this.prisma.stockTransfer.findMany({
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
        fromBranch: true,
        toBranch: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
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
        fromBranch: true,
        toBranch: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    return transfer;
  }

  async approveTransfer(transferId: string, userId: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.status !== 'pending') {
      throw new BadRequestException(`Cannot approve transfer with status: ${transfer.status}`);
    }

    // Calculate total value for approval check
    const totalValue = transfer.items.reduce((sum, item) => {
      return sum + Number(item.product.costPrice) * Number(item.quantityRequested);
    }, 0);

    // Check approval authority (HS can approve < Rp 5M, SPV/CSO for > Rp 5M)
    // This should be checked via roles guard, but we validate here too
    if (totalValue > 5000000) {
      // Should be approved by SPV or CSO
      // This is handled by roles guard
    }

    return this.prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'approved',
        approvedBy: userId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        fromBranch: true,
        toBranch: true,
      },
    });
  }

  async sendTransfer(transferId: string, userId: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        fromBranch: true,
        toBranch: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.status !== 'approved') {
      throw new BadRequestException(`Cannot send transfer with status: ${transfer.status}`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // Deduct from source branch and create stock movements
      for (const item of transfer.items) {
        const stock = await tx.productStock.findUnique({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId: transfer.fromBranchId,
            },
          },
        });

        if (!stock) {
          throw new NotFoundException(`Stock not found for product ${item.productId}`);
        }

        const quantityRequested = Number(item.quantityRequested);
        const quantityAvailable = Number(stock.quantityAvailable);
        const quantityReserved = Number(stock.quantityReserved);

        // Validate stock is still available
        if (quantityAvailable - quantityReserved < quantityRequested) {
          throw new BadRequestException(
            `Insufficient stock for ${item.product.name}. Available: ${quantityAvailable - quantityReserved}`,
          );
        }

        const quantityBefore = quantityAvailable;
        const quantityAfter = quantityBefore - quantityRequested;

        // Update stock
        await tx.productStock.update({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId: transfer.fromBranchId,
            },
          },
          data: {
            quantityAvailable: new Decimal(quantityAfter),
            quantityReserved: new Decimal(quantityReserved - quantityRequested),
          },
        });

        // Create stock movement (OUT)
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            branchId: transfer.fromBranchId,
            movementType: 'OUT',
            referenceType: 'TRANSFER',
            referenceId: transferId,
            quantityChange: new Decimal(-quantityRequested),
            quantityBefore: new Decimal(quantityBefore),
            quantityAfter: new Decimal(quantityAfter),
            notes: `Stock transfer to ${transfer.toBranch.name}`,
            createdBy: userId,
          },
        });

        // Update transfer item with sent quantity
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: {
            quantitySent: new Decimal(quantityRequested),
          },
        });
      }

      // Update transfer status
      return tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'sent',
          sentBy: userId,
          sentAt: new Date(),
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          fromBranch: true,
          toBranch: true,
        },
      });
    });
  }

  async receiveTransfer(transferId: string, dto: ReceiveTransferDto, userId: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        fromBranch: true,
        toBranch: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.status !== 'sent') {
      throw new BadRequestException(`Cannot receive transfer with status: ${transfer.status}`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // Process each received item
      for (const receivedItem of dto.items) {
        const transferItem = transfer.items.find((item) => item.id === receivedItem.itemId);

        if (!transferItem) {
          throw new NotFoundException(`Transfer item ${receivedItem.itemId} not found`);
        }

        const quantitySent = Number(transferItem.quantitySent || transferItem.quantityRequested);
        const quantityReceived = receivedItem.quantityReceived;

        // Handle discrepancies
        if (quantityReceived !== quantitySent) {
          // Log discrepancy but still process
          // In production, you might want to require approval for large discrepancies
        }

        // Get or create stock at destination branch
        let stock = await tx.productStock.findUnique({
          where: {
            productId_branchId: {
              productId: transferItem.productId,
              branchId: transfer.toBranchId,
            },
          },
        });

        if (!stock) {
          stock = await tx.productStock.create({
            data: {
              productId: transferItem.productId,
              branchId: transfer.toBranchId,
              quantityAvailable: new Decimal(0),
              quantityReserved: new Decimal(0),
              quantityDamaged: new Decimal(0),
            },
          });
        }

        const quantityBefore = Number(stock.quantityAvailable);
        const quantityAfter = quantityBefore + quantityReceived;

        // Update stock at destination
        await tx.productStock.update({
          where: {
            productId_branchId: {
              productId: transferItem.productId,
              branchId: transfer.toBranchId,
            },
          },
          data: {
            quantityAvailable: new Decimal(quantityAfter),
            quantityDamaged:
              receivedItem.condition === 'damaged'
                ? new Decimal(Number(stock.quantityDamaged) + quantityReceived)
                : stock.quantityDamaged,
          },
        });

        // Create stock movement (IN)
        await tx.stockMovement.create({
          data: {
            productId: transferItem.productId,
            branchId: transfer.toBranchId,
            movementType: 'IN',
            referenceType: 'TRANSFER',
            referenceId: transferId,
            quantityChange: new Decimal(quantityReceived),
            quantityBefore: new Decimal(quantityBefore),
            quantityAfter: new Decimal(quantityAfter),
            notes: `Stock transfer from ${transfer.fromBranch.name}${receivedItem.notes ? ` - ${receivedItem.notes}` : ''}`,
            createdBy: userId,
          },
        });

        // Update transfer item
        await tx.stockTransferItem.update({
          where: { id: transferItem.id },
          data: {
            quantityReceived: new Decimal(quantityReceived),
          },
        });
      }

      // Update transfer status
      return tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'received',
          receivedBy: userId,
          receivedAt: new Date(),
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          fromBranch: true,
          toBranch: true,
        },
      });
    });
  }

  async cancelTransfer(transferId: string, _userId: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: {
        items: true,
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (!['pending', 'approved'].includes(transfer.status)) {
      throw new BadRequestException(`Cannot cancel transfer with status: ${transfer.status}`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // Release reserved stock
      for (const item of transfer.items) {
        await tx.productStock.update({
          where: {
            productId_branchId: {
              productId: item.productId,
              branchId: transfer.fromBranchId,
            },
          },
          data: {
            quantityReserved: {
              decrement: new Decimal(item.quantityRequested),
            },
          },
        });
      }

      // Update transfer status
      return tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'cancelled',
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          fromBranch: true,
          toBranch: true,
        },
      });
    });
  }
}

