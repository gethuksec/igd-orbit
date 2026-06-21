import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { CreateSalesTransactionDto, VoidTransactionDto, HoldTransactionDto } from './dto';
import { CustomersService } from '../customers/customers.service';
import { JournalEntriesService } from '../finance/services/journal-entries.service';
import { randomBytes } from 'crypto';

/**
 * Transaction Calculation Result
 */
interface TransactionCalculation {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

/**
 * Sales Transactions Service
 * Handles POS transaction operations
 */
@Injectable()
export class SalesTransactionsService {
  constructor(
    private prisma: PrismaService,
    private customersService: CustomersService,
    @Inject(forwardRef(() => JournalEntriesService))
    private journalEntriesService?: JournalEntriesService,
  ) {}

  /**
   * Generate unique transaction number
   * Format: TRX-{YYYYMMDD}-{UserInitials}-{sequence}
   * @param userId - User ID to get initials from
   * @returns Generated transaction number
   */
  async generateTransactionNumber(userId?: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get user initials if userId provided
    let userInitials = '';
    if (userId) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { fullName: true },
        });
        
        if (user?.fullName) {
          // Extract initials from fullName (first 2 letters, uppercase)
          const nameParts = user.fullName.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            // First letter of first name + first letter of last name
            userInitials = (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
          } else if (nameParts.length === 1 && nameParts[0].length >= 2) {
            // First 2 letters of single name
            userInitials = nameParts[0].substring(0, 2).toUpperCase();
          } else {
            // Fallback: use first 2 characters
            userInitials = user.fullName.substring(0, 2).toUpperCase().padEnd(2, 'X');
          }
        }
      } catch (error) {
        console.error('Error getting user initials:', error);
        // Continue with empty initials if error
      }
    }
    
    // Generate sequence number (4 digits, zero-padded)
    // Count transactions for today with same user initials
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    let sequence = 1;
    if (userInitials) {
      try {
        const todayTransactions = await this.prisma.salesTransaction.count({
          where: {
            transactionNumber: {
              startsWith: `TRX-${dateStr}-${userInitials}-`,
            },
            createdAt: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        });
        sequence = todayTransactions + 1;
      } catch (error) {
        console.error('Error counting transactions:', error);
        // Use random fallback
        const random = randomBytes(2).toString('hex').toUpperCase();
        return `TRX-${dateStr}-${userInitials || 'XX'}-${random}`;
      }
    } else {
      // Fallback: use random if no user initials
      const random = randomBytes(2).toString('hex').toUpperCase();
      return `TRX-${dateStr}-XX-${random}`;
    }
    
    return `TRX-${dateStr}-${userInitials || 'XX'}-${sequence.toString().padStart(4, '0')}`;
  }

  /**
   * Calculate transaction totals
   * @param items - Transaction items
   * @param discountPercent - Transaction discount percentage
   * @param discountAmount - Transaction discount amount
   * @param taxPercent - Tax percentage
   * @returns Calculation result
   */
  calculateTransaction(
    items: Array<{
      quantity: number;
      unitPrice: number;
      discountPercentage?: number;
      discountAmount?: number;
    }>,
    discountPercent?: number,
    discountAmount?: number,
    taxPercent: number = 11,
  ): TransactionCalculation {
    // Calculate subtotal from items
    let subtotal = 0;
    for (const item of items) {
      const itemSubtotal = item.quantity * item.unitPrice;
      const itemDiscount = item.discountAmount || itemSubtotal * ((item.discountPercentage || 0) / 100);
      subtotal += itemSubtotal - itemDiscount;
    }

    // Calculate transaction discount
    const transactionDiscount = discountAmount || subtotal * ((discountPercent || 0) / 100);
    const subtotalAfterDiscount = subtotal - transactionDiscount;

    // Calculate tax
    const tax = subtotalAfterDiscount * (taxPercent / 100);
    const total = subtotalAfterDiscount + tax;

    // Validate total is not negative
    if (total < 0) {
      throw new BadRequestException('Discount cannot make total negative');
    }

    return {
      subtotal,
      discount: transactionDiscount,
      tax,
      total,
    };
  }

  /**
   * Create POS transaction
   * @param createDto - Transaction creation data
   * @param userId - Cashier user ID
   * @param branchId - Branch ID (from user context or request)
   * @returns Created transaction
   */
  async create(createDto: CreateSalesTransactionDto, userId: string, branchId: string) {
    // Validate items not empty
    if (!createDto.items || createDto.items.length === 0) {
      throw new BadRequestException('Transaction must have at least one item');
    }

    // Validate customer if provided
    if (createDto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: createDto.customerId },
      });
      if (!customer) {
        throw new NotFoundException('Customer not found');
      }
      if (customer.isBlacklisted) {
        throw new ForbiddenException('Customer is blacklisted and cannot make purchases');
      }
    }

    // Validate customer required for credit transactions
    if (createDto.payment.method === 'credit' && !createDto.customerId) {
      throw new BadRequestException('Customer is required for credit transactions');
    }

    // Look up customer tier for tier-based pricing
    let customerTierId: string | null = null;
    if (createDto.customerId) {
      const customerWithTier = await this.prisma.customer.findUnique({
        where: { id: createDto.customerId },
        select: { tierId: true },
      });
      customerTierId = customerWithTier?.tierId || null;
    }

    // Validate branch
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    // Validate all products exist and have stock
    const productIds = createDto.items.map((item) => item.productId);
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        deletedAt: null,
        isActive: true,
      },
      include: {
        productStocks: {
          where: { branchId },
        },
      },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found');
    }

    // Check stock availability and validate serial/batch
    for (const item of createDto.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }

      const stock = product.productStocks[0];
      if (!stock) {
        throw new BadRequestException(`Product ${product.name} has no stock in this branch`);
      }

      const availableStock = stock.quantityAvailable.toNumber() - stock.quantityReserved.toNumber();
      if (item.quantity > availableStock) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${item.quantity}`,
        );
      }

      // Validate serial/batch for tracked items
      if (product.trackSerial && !item.serialNumber) {
        throw new BadRequestException(`Serial number is required for ${product.name}`);
      }
      if (product.trackBatch && !item.batchNumber) {
        throw new BadRequestException(`Batch number is required for ${product.name}`);
      }
    }

    // Calculate transaction totals
    const calculation = this.calculateTransaction(
      createDto.items,
      createDto.discountPercentage,
      createDto.discountAmount,
      createDto.taxPercentage,
    );

    // Check credit limit if credit payment
    if (createDto.payment.method === 'credit' && createDto.customerId) {
      const canPurchase = await this.customersService.checkCreditLimit(
        createDto.customerId,
        calculation.total,
      );
      if (!canPurchase) {
        throw new BadRequestException('Insufficient credit limit');
      }
    }

    // Generate transaction number with user initials
    const transactionNumber = await this.generateTransactionNumber(userId);

    // Start database transaction
    return await this.prisma.$transaction(async (tx) => {
      // Create sales transaction
      const transaction = await tx.salesTransaction.create({
        data: {
          transactionNumber,
          transactionType: createDto.transactionType,
          branchId,
          customerId: createDto.customerId || null,
          cashierId: userId,
          status: 'completed', // All transactions are completed once created (pending is for held transactions)
          subtotal: calculation.subtotal,
          discountAmount: calculation.discount,
          discountPercentage: createDto.discountPercentage || null,
          taxAmount: calculation.tax,
          taxPercentage: createDto.taxPercentage || 11,
          total: calculation.total,
          paymentStatus: createDto.payment.method === 'credit' ? 'pending' : 'paid',
          notes: createDto.notes || null,
        },
      });

      // Create transaction items
      const items = [];
      for (const itemDto of createDto.items) {
        const product = products.find((p) => p.id === itemDto.productId)!;

        // Apply tier pricing if customer has a tier
        let effectiveUnitPrice = itemDto.unitPrice;
        if (customerTierId) {
          const memberPricing = (product.memberPricing as Record<string, any>) || {};
          // memberPricing is keyed by tierId (UUID), each value is the tier price
          if (memberPricing[customerTierId] !== undefined) {
            const tierPrice = memberPricing[customerTierId];
            // Support both direct number and { price: number } format
            effectiveUnitPrice = typeof tierPrice === 'number' ? tierPrice : (tierPrice.price ?? tierPrice);
          }
        }

        const itemSubtotal = itemDto.quantity * effectiveUnitPrice;
        const itemDiscount =
          itemDto.discountAmount || itemSubtotal * ((itemDto.discountPercentage || 0) / 100);
        const itemTotal = itemSubtotal - itemDiscount;

        // Store the effective unit price (tier price if applied)
        itemDto.unitPrice = effectiveUnitPrice;

        const item = await tx.salesTransactionItem.create({
          data: {
            transactionId: transaction.id,
            productId: itemDto.productId,
            productName: product.name,
            productSku: product.sku,
            quantity: itemDto.quantity,
            unitPrice: itemDto.unitPrice,
            discountAmount: itemDiscount,
            discountPercentage: itemDto.discountPercentage || null,
            subtotal: itemTotal,
            batchNumber: itemDto.batchNumber || null,
            serialNumber: itemDto.serialNumber || null,
            notes: itemDto.notes || null,
          },
        });
        items.push(item);

        // Deduct stock
        const stock = product.productStocks[0];
        const quantityBefore = stock.quantityAvailable.toNumber();
        const quantityAfter = quantityBefore - itemDto.quantity;

        await tx.productStock.update({
          where: { id: stock.id },
          data: {
            quantityAvailable: quantityAfter,
          },
        });

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            productId: itemDto.productId,
            branchId,
            movementType: 'OUT',
            referenceType: 'SALE',
            referenceId: transaction.id,
            quantityChange: -itemDto.quantity,
            quantityBefore,
            quantityAfter,
            batchNumber: itemDto.batchNumber || null,
            serialNumber: itemDto.serialNumber || null,
            notes: `Sale: ${transaction.transactionNumber} - ${product.name} (${itemDto.quantity} unit)`,
            createdBy: userId,
          },
        });
      }

      // Create payment record
      await tx.payment.create({
        data: {
          transactionId: transaction.id,
          paymentMethod: createDto.payment.method,
          amount: calculation.total,
          paymentDetails: createDto.payment.details ? (createDto.payment.details as any) : undefined,
          status: createDto.payment.method === 'credit' ? 'pending' : 'completed',
          paidAt: createDto.payment.method === 'credit' ? null : new Date(),
        },
      });

      // Update customer statistics if customer provided
      if (createDto.customerId) {
        if (createDto.payment.method === 'credit') {
          // Update credit used
          await this.customersService.updateCreditUsed(createDto.customerId, calculation.total);
        }
        // TODO: Update customer statistics (total_purchases, last_purchase)
        // This will be implemented when we have transaction aggregation
      }

      // Generate receipt
      const receiptUrl = await this.generateReceipt(transaction.id);

      // Update transaction with receipt URL
      const updatedTransaction = await tx.salesTransaction.update({
        where: { id: transaction.id },
        data: { receiptUrl },
        include: {
          branch: true,
          customer: {
            include: {
              tier: true,
            },
          },
          cashier: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
          payments: true,
        },
      });

      // Auto-generate journal entry (outside transaction to avoid circular dependency)
      if (this.journalEntriesService) {
        try {
          const journalItems = items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity.toNumber(),
            costPrice: products.find((p) => p.id === item.productId)?.costPrice?.toNumber() || 0,
          }));

          await this.journalEntriesService.autoGenerateFromSalesTransaction(
            transaction.id,
            branchId,
            calculation.total,
            createDto.payment.method,
            journalItems,
            userId,
          );
        } catch (error) {
          // Don't fail transaction if journal creation fails
          console.error('Error creating auto journal entry:', error);
        }
      }

      return updatedTransaction;
    });
  }

  /**
   * Generate receipt PDF
   * @param transactionId - Transaction ID
   * @returns Receipt URL
   */
  async generateReceipt(transactionId: string): Promise<string> {
    // TODO: Implement PDF generation using puppeteer or pdfkit
    // For now, return placeholder URL
    return `/uploads/receipts/${transactionId}.pdf`;
  }

  /**
   * Void transaction
   * @param transactionId - Transaction ID
   * @param voidDto - Void data
   * @param userId - User ID who voided
   */
  async void(transactionId: string, voidDto: VoidTransactionDto, userId: string): Promise<void> {
    const transaction = await this.prisma.salesTransaction.findUnique({
      where: { id: transactionId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Check if can be voided
    if (transaction.status === 'void' || transaction.status === 'cancelled') {
      throw new BadRequestException('Transaction is already voided or cancelled');
    }

    if (transaction.status === 'completed' && transaction.paymentStatus === 'paid') {
      // Check permission for voiding completed transaction
      // Same day = HS, past = SPV
      const transactionDate = new Date(transaction.createdAt);
      const today = new Date();
      const isSameDay =
        transactionDate.getDate() === today.getDate() &&
        transactionDate.getMonth() === today.getMonth() &&
        transactionDate.getFullYear() === today.getFullYear();

      // TODO: Check user role (HS for same day, SPV for past)
      // For now, allow if same day
      if (!isSameDay) {
        throw new ForbiddenException('Only supervisor can void past transactions');
      }
    }

    // Start database transaction
    await this.prisma.$transaction(async (tx) => {
      // Update transaction status
      await tx.salesTransaction.update({
        where: { id: transactionId },
        data: {
          status: 'void',
          voidReason: voidDto.reason,
          voidedAt: new Date(),
          voidedBy: userId,
        },
      });

      // Reverse stock movements and restore stock
      for (const item of transaction.items) {
        // Find stock movement for this item
        const stockMovement = await tx.stockMovement.findFirst({
          where: {
            referenceId: transactionId,
            productId: item.productId,
            movementType: 'OUT',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (stockMovement) {
          // Restore stock
          const stock = await tx.productStock.findFirst({
            where: {
              productId: item.productId,
              branchId: transaction.branchId,
            },
          });

          if (stock) {
            const quantityBefore = stock.quantityAvailable.toNumber();
            const quantityAfter = quantityBefore + item.quantity.toNumber();

            await tx.productStock.update({
              where: { id: stock.id },
              data: {
                quantityAvailable: quantityAfter,
              },
            });

            // Create reverse stock movement
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                branchId: transaction.branchId,
                movementType: 'IN',
                referenceType: 'VOID',
                referenceId: transactionId,
                quantityChange: item.quantity.toNumber(),
                quantityBefore,
                quantityAfter,
                batchNumber: item.batchNumber || null,
                serialNumber: item.serialNumber || null,
                createdBy: userId,
                notes: `Void transaction ${transaction.transactionNumber}`,
              },
            });
          }
        }
      }

      // Update customer statistics if customer exists
      if (transaction.customerId) {
        // TODO: Reverse customer statistics update
        // This will be implemented when we have transaction aggregation
      }
    });
  }

  /**
   * Hold transaction
   * @param transactionId - Transaction ID
   * @param holdDto - Hold data
   * @param userId - Cashier user ID
   * @param branchId - Branch ID
   * @returns Hold ID
   */
  async hold(
    transactionId: string,
    holdDto: HoldTransactionDto,
    userId: string,
    branchId: string,
  ): Promise<string> {
    const transaction = await this.prisma.salesTransaction.findUnique({
      where: { id: transactionId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.status !== 'pending') {
      throw new BadRequestException('Only pending transactions can be held');
    }

    // Prepare transaction data for holding
    const transactionData = {
      transactionId: transaction.id,
      transactionNumber: transaction.transactionNumber,
      items: transaction.items,
      customer: transaction.customer,
      subtotal: transaction.subtotal.toNumber(),
      discountAmount: transaction.discountAmount.toNumber(),
      taxAmount: transaction.taxAmount.toNumber(),
      total: transaction.total.toNumber(),
    };

    // Set expiry to 24 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Create held transaction
    const heldTransaction = await this.prisma.heldTransaction.create({
      data: {
        reference: holdDto.reference || null,
        transactionData: transactionData as any,
        branchId,
        cashierId: userId,
        expiresAt,
      },
    });

    // Update transaction status to held
    await this.prisma.salesTransaction.update({
      where: { id: transactionId },
      data: { status: 'held' },
    });

    return heldTransaction.id;
  }

  /**
   * Resume held transaction
   * @param holdId - Hold transaction ID
   * @returns Cart data
   */
  async resume(holdId: string) {
    const heldTransaction = await this.prisma.heldTransaction.findUnique({
      where: { id: holdId },
    });

    if (!heldTransaction) {
      throw new NotFoundException('Held transaction not found');
    }

    // Check if expired
    if (new Date() > heldTransaction.expiresAt) {
      throw new BadRequestException('Held transaction has expired');
    }

    // Validate products still available
    const transactionData = heldTransaction.transactionData as any;
    const items = transactionData.items || [];

    for (const item of items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          productStocks: {
            where: { branchId: heldTransaction.branchId },
          },
        },
      });

      if (!product || !product.isActive) {
        throw new BadRequestException(`Product ${item.productName} is no longer available`);
      }

      const stock = product.productStocks[0];
      if (!stock) {
        throw new BadRequestException(`Product ${item.productName} has no stock`);
      }

      const availableStock = stock.quantityAvailable.toNumber() - stock.quantityReserved.toNumber();
      if (item.quantity > availableStock) {
        throw new BadRequestException(
          `Insufficient stock for ${item.productName}. Available: ${availableStock}`,
        );
      }
    }

    // Delete hold record
    await this.prisma.heldTransaction.delete({
      where: { id: holdId },
    });

    return transactionData;
  }

  /**
   * List held transactions
   * @param branchId - Branch ID (optional, filter by branch)
   * @returns List of held transactions
   */
  async listHeldTransactions(branchId?: string) {
    const where: any = {
      expiresAt: {
        gt: new Date(), // Only non-expired
      },
    };

    if (branchId) {
      where.branchId = branchId;
    }

    const heldTransactions = await this.prisma.heldTransaction.findMany({
      where,
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        cashier: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return heldTransactions.map((held) => ({
      id: held.id,
      reference: held.reference,
      branch: held.branch,
      cashier: held.cashier,
      expiresAt: held.expiresAt,
      createdAt: held.createdAt,
      transactionData: held.transactionData,
    }));
  }

  /**
   * Find transaction by ID
   * @param id - Transaction ID
   * @returns Transaction detail
   */
  async findById(id: string) {
    const transaction = await this.prisma.salesTransaction.findUnique({
      where: { id },
      include: {
        branch: {
          select: {
            id: true,
            name: true,
            code: true,
            address: true,
            phone: true,
          },
        },
        customer: {
          include: {
            tier: true,
          },
        },
        cashier: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return {
      id: transaction.id,
      transactionNumber: transaction.transactionNumber,
      transactionType: transaction.transactionType,
      branch: transaction.branch,
      customer: transaction.customer
        ? {
            id: transaction.customer.id,
            customerCode: transaction.customer.customerCode,
            name: transaction.customer.name,
            tier: transaction.customer.tier
              ? {
                  code: transaction.customer.tier.code,
                  name: transaction.customer.tier.name,
                }
              : null,
          }
        : null,
      cashier: transaction.cashier,
      status: transaction.status,
      subtotal: transaction.subtotal.toNumber(),
      discountAmount: transaction.discountAmount.toNumber(),
      discountPercentage: transaction.discountPercentage?.toNumber() || null,
      taxAmount: transaction.taxAmount.toNumber(),
      taxPercentage: transaction.taxPercentage.toNumber(),
      total: transaction.total.toNumber(),
      paymentStatus: transaction.paymentStatus,
      items: transaction.items.map((item) => ({
        id: item.id,
        product: item.product,
        productName: item.productName,
        productSku: item.productSku,
        quantity: item.quantity.toNumber(),
        unitPrice: item.unitPrice.toNumber(),
        discountAmount: item.discountAmount.toNumber(),
        discountPercentage: item.discountPercentage?.toNumber() || null,
        subtotal: item.subtotal.toNumber(),
        batchNumber: item.batchNumber,
        serialNumber: item.serialNumber,
        notes: item.notes,
      })),
      payments: transaction.payments.map((payment) => ({
        id: payment.id,
        paymentMethod: payment.paymentMethod,
        amount: payment.amount.toNumber(),
        paymentDetails: payment.paymentDetails,
        status: payment.status,
        paidAt: payment.paidAt,
      })),
      receiptUrl: transaction.receiptUrl,
      notes: transaction.notes,
      voidReason: transaction.voidReason,
      voidedAt: transaction.voidedAt,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }

  /**
   * List transactions
   * @param query - Query parameters
   * @returns Paginated list of transactions
   */
  async findAll(query: any) {
    const { page = 1, limit = 20, branchId, customerId, status, transactionType } = query;
    
    // Ensure page and limit are numbers (fallback if transform didn't work)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;
    
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};
    if (branchId) {
      where.branchId = branchId;
    }
    if (customerId) {
      where.customerId = customerId;
    }
    if (status) {
      where.status = status;
    }
    if (transactionType) {
      where.transactionType = transactionType;
    }

    // Check if items should be included (for returns page)
    const includeItems = query.includeItems === 'true' || query.includeItems === true;

    const [transactions, total] = await Promise.all([
      this.prisma.salesTransaction.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          branch: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          customer: {
            select: {
              id: true,
              customerCode: true,
              name: true,
            },
          },
          cashier: {
            select: {
              id: true,
              fullName: true,
            },
          },
          _count: {
            select: {
              items: true,
            },
          },
          ...(includeItems ? {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                  },
                },
              },
            },
          } : {}),
        },
      }),
      this.prisma.salesTransaction.count({ where }),
    ]);

    return {
      data: transactions.map((tx) => ({
        id: tx.id,
        transactionNumber: tx.transactionNumber,
        transactionType: tx.transactionType,
        branch: tx.branch,
        customer: tx.customer,
        cashier: tx.cashier,
        status: tx.status,
        total: tx.total.toNumber(),
        paymentStatus: tx.paymentStatus,
        itemCount: tx._count.items,
        ...(includeItems && 'items' in tx ? {
          items: tx.items.map((item: any) => ({
            id: item.id,
            productId: item.productId,
            product: item.product,
            productName: item.productName,
            productSku: item.productSku,
            quantity: item.quantity.toNumber(),
            unitPrice: item.unitPrice.toNumber(),
          })),
        } : {}),
        createdAt: tx.createdAt,
      })),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  /**
   * Update transaction (only if status = pending)
   * @param id - Transaction ID
   * @param _updateDto - Update data
   * @param _userId - User ID
   */
  async update(id: string, _updateDto: any, _userId: string) {
    const transaction = await this.prisma.salesTransaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.status !== 'pending') {
      throw new BadRequestException('Only pending transactions can be updated');
    }

    // TODO: Implement update logic
    // For now, return error
    throw new BadRequestException('Update functionality will be implemented in next phase');
  }
}

