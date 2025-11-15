import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  ListCustomersDto,
  BlacklistCustomerDto,
  MergeCustomersDto,
} from './dto';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomBytes } from 'crypto';

/**
 * Customer Statistics Interface
 */
export interface CustomerStatistics {
  totalPurchases: number;
  totalOrders: number;
  averageOrderValue: number;
  lastPurchaseDate: Date | null;
  firstPurchaseDate: Date | null;
  lifetimeValue: number;
}

/**
 * Customers Service
 * Handles customer management operations
 */
@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate unique customer code
   * Format: CUST-{random}
   * @returns Generated code string
   */
  async generateCustomerCode(): Promise<string> {
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString('hex').toUpperCase();
      code = `CUST-${random}`;

      const existing = await this.prisma.customer.findUnique({
        where: { customerCode: code },
      });

      if (!existing) {
        isUnique = true;
      }

      attempts++;
    }

    if (!isUnique) {
      throw new BadRequestException('Failed to generate unique customer code after multiple attempts');
    }

    return code!;
  }

  /**
   * Seed customer tiers
   * Creates default tiers if they don't exist
   */
  async seedCustomerTiers(): Promise<void> {
    const tiers = [
      {
        code: 'PLATINUM',
        name: 'Platinum',
        description: 'Highest tier with maximum benefits',
        discountPercentage: new Decimal('15.00'),
        creditLimit: new Decimal('10000000'),
        minPurchaseAmount: new Decimal('50000000'),
      },
      {
        code: 'GOLD',
        name: 'Gold',
        description: 'Premium tier with good benefits',
        discountPercentage: new Decimal('10.00'),
        creditLimit: new Decimal('5000000'),
        minPurchaseAmount: new Decimal('20000000'),
      },
      {
        code: 'SILVER',
        name: 'Silver',
        description: 'Standard tier with basic benefits',
        discountPercentage: new Decimal('5.00'),
        creditLimit: new Decimal('2000000'),
        minPurchaseAmount: new Decimal('5000000'),
      },
      {
        code: 'USER',
        name: 'Regular User',
        description: 'Default tier for new customers',
        discountPercentage: new Decimal('0.00'),
        creditLimit: new Decimal('0'),
        minPurchaseAmount: null,
      },
    ];

    for (const tier of tiers) {
      await this.prisma.customerTier.upsert({
        where: { code: tier.code },
        update: {},
        create: tier,
      });
    }
  }

  /**
   * Check and upgrade customer tier based on total purchases
   * @param customerId - Customer ID
   */
  async checkAndUpgradeTier(customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { tier: true },
    });

    if (!customer) {
      return;
    }

    // Get customer statistics
    const stats = await this.getStatistics(customerId);

    // Get all active tiers sorted by minPurchaseAmount (descending)
    const tiers = await this.prisma.customerTier.findMany({
      where: { isActive: true },
      orderBy: { minPurchaseAmount: 'desc' },
    });

    // Find the highest tier the customer qualifies for
    let newTierId: string | null = null;
    for (const tier of tiers) {
      if (tier.minPurchaseAmount && tier.minPurchaseAmount.toNumber() && stats.totalPurchases >= tier.minPurchaseAmount.toNumber()) {
        newTierId = tier.id;
        break;
      }
    }

    // If no tier found, assign USER tier
    if (!newTierId) {
      const userTier = await this.prisma.customerTier.findUnique({
        where: { code: 'USER' },
      });
      if (userTier) {
        newTierId = userTier.id;
      }
    }

    // Update tier if changed
    if (newTierId && customer.tierId !== newTierId) {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { tierId: newTierId },
      });

      // TODO: Send notification to customer about tier upgrade
      console.log(`Customer ${customer.customerCode} upgraded to new tier`);
    }
  }

  /**
   * Find all customers with pagination and filters
   * @param query - Query parameters
   * @returns Paginated list of customers
   */
  async findAll(query: ListCustomersDto) {
    const {
      page = 1,
      limit = 20,
      search,
      'filter[tier]': filterTier,
      'filter[type]': filterType,
      'filter[branch]': filterBranch,
      'filter[status]': filterStatus = 'active',
      'filter[blacklisted]': filterBlacklisted,
      sort = 'name',
      order = 'asc',
    } = query;

    // Ensure page and limit are numbers (fallback if transform didn't work)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.CustomerWhereInput = {
      deletedAt: filterStatus === 'active' ? null : { not: null },
    };

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { customerCode: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Tier filter
    if (filterTier && filterTier.length > 0) {
      where.tierId = { in: filterTier };
    }

    // Type filter
    if (filterType && filterType.length > 0) {
      where.customerType = { in: filterType };
    }

    // Branch filter
    if (filterBranch) {
      where.preferredBranchId = filterBranch;
    }

    // Blacklist filter
    if (filterBlacklisted !== undefined) {
      where.isBlacklisted = filterBlacklisted;
    }

    // Determine sort field
    let orderBy: Prisma.CustomerOrderByWithRelationInput;
    if (sort === 'totalPurchases') {
      // TODO: Sort by total purchases (requires aggregation)
      orderBy = { name: order };
    } else if (sort === 'lastPurchase') {
      // TODO: Sort by last purchase date (requires transaction join)
      orderBy = { name: order };
    } else {
      orderBy = { name: order };
    }

    let customers, total;
    try {
      [customers, total] = await Promise.all([
        this.prisma.customer.findMany({
          where,
          skip,
          take: limitNum,
          orderBy,
          include: {
            tier: true,
            preferredBranch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        }),
        this.prisma.customer.count({ where }),
      ]);
    } catch (error) {
      console.error('Database error in customers.findAll:', error);
      throw error;
    }

    return {
      data: customers.map((customer) => {
        try {
          return {
            id: customer.id,
            customerCode: customer.customerCode,
            customerType: customer.customerType,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            tier: customer.tier
              ? {
                  id: customer.tier.id,
                  code: customer.tier.code,
                  name: customer.tier.name,
                  discountPercentage: customer.tier.discountPercentage
                    ? customer.tier.discountPercentage.toNumber()
                    : 0,
                }
              : null,
            creditLimit: customer.creditLimit ? customer.creditLimit.toNumber() : 0,
            creditUsed: customer.creditUsed ? customer.creditUsed.toNumber() : 0,
            creditAvailable: customer.creditLimit && customer.creditUsed
              ? customer.creditLimit.toNumber() - customer.creditUsed.toNumber()
              : 0,
            isBlacklisted: customer.isBlacklisted,
            isActive: customer.isActive,
            preferredBranch: customer.preferredBranch,
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
          };
        } catch (error) {
          console.error('Error mapping customer:', customer.id, error);
          // Return safe fallback
          return {
            id: customer.id,
            customerCode: customer.customerCode || '',
            customerType: customer.customerType,
            name: customer.name || '',
            email: customer.email || null,
            phone: customer.phone || '',
            tier: null,
            creditLimit: 0,
            creditUsed: 0,
            creditAvailable: 0,
            isBlacklisted: customer.isBlacklisted || false,
            isActive: customer.isActive || false,
            preferredBranch: customer.preferredBranch || null,
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
          };
        }
      }),
        meta: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
    };
  }

  /**
   * Find customer by ID with statistics
   * @param id - Customer ID
   * @returns Customer detail
   */
  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        tier: true,
        preferredBranch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Get statistics
    const stats = await this.getStatistics(id);

    return {
      id: customer.id,
      customerCode: customer.customerCode,
      customerType: customer.customerType,
      tier: customer.tier
        ? {
            id: customer.tier.id,
            code: customer.tier.code,
            name: customer.tier.name,
            discountPercentage: customer.tier.discountPercentage
              ? customer.tier.discountPercentage.toNumber()
              : 0,
            creditLimit: customer.tier.creditLimit
              ? customer.tier.creditLimit.toNumber()
              : 0,
          }
        : null,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      alternatePhone: customer.alternatePhone,
      dateOfBirth: customer.dateOfBirth,
      gender: customer.gender,
      address: customer.address,
      city: customer.city,
      province: customer.province,
      postalCode: customer.postalCode,
      country: customer.country,
      taxId: customer.taxId,
      taxName: customer.taxName,
      taxAddress: customer.taxAddress,
      creditLimit: customer.creditLimit ? customer.creditLimit.toNumber() : 0,
      creditUsed: customer.creditUsed ? customer.creditUsed.toNumber() : 0,
      creditAvailable: customer.creditLimit && customer.creditUsed
        ? customer.creditLimit.toNumber() - customer.creditUsed.toNumber()
        : 0,
      paymentTermDays: customer.paymentTermDays,
      preferredBranch: customer.preferredBranch,
      isBlacklisted: customer.isBlacklisted,
      blacklistReason: customer.blacklistReason,
      blacklistUntil: customer.blacklistUntil,
      isActive: customer.isActive,
      notes: customer.notes,
      statistics: stats,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  /**
   * Create new customer
   * @param createCustomerDto - Customer creation data
   * @param _userId - User ID who created this customer
   * @returns Created customer
   */
  async create(createCustomerDto: CreateCustomerDto, _userId: string) {
    // Generate customer code if not provided
    let customerCode = createCustomerDto.customerCode;
    if (!customerCode) {
      customerCode = await this.generateCustomerCode();
    } else {
      // Check code uniqueness
      const existing = await this.prisma.customer.findUnique({
        where: { customerCode },
      });
      if (existing) {
        throw new ConflictException('Customer code already exists');
      }
    }

    // Validate email uniqueness if provided
    if (createCustomerDto.email) {
      const existingEmail = await this.prisma.customer.findFirst({
        where: {
          email: createCustomerDto.email,
          deletedAt: null,
        },
      });
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    // Validate phone uniqueness
    const existingPhone = await this.prisma.customer.findFirst({
      where: {
        phone: createCustomerDto.phone,
        deletedAt: null,
      },
    });
    if (existingPhone) {
      throw new ConflictException('Phone number already exists');
    }

    // Validate tier if provided
    if (createCustomerDto.tierId) {
      const tier = await this.prisma.customerTier.findUnique({
        where: { id: createCustomerDto.tierId },
      });
      if (!tier) {
        throw new NotFoundException('Customer tier not found');
      }
    }

    // Validate preferred branch if provided
    if (createCustomerDto.preferredBranchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: createCustomerDto.preferredBranchId },
      });
      if (!branch) {
        throw new NotFoundException('Preferred branch not found');
      }
    }

    // Prepare customer data
    const customerData: any = {
      customerCode,
      customerType: createCustomerDto.customerType,
      name: createCustomerDto.name,
      phone: createCustomerDto.phone,
      creditLimit: createCustomerDto.creditLimit || 0,
      creditUsed: 0,
      isActive: true,
    };

    if (createCustomerDto.tierId) {
      customerData.tierId = createCustomerDto.tierId;
    }
    if (createCustomerDto.email) {
      customerData.email = createCustomerDto.email;
    }
    if (createCustomerDto.alternatePhone) {
      customerData.alternatePhone = createCustomerDto.alternatePhone;
    }
    if (createCustomerDto.dateOfBirth) {
      customerData.dateOfBirth = new Date(createCustomerDto.dateOfBirth);
    }
    if (createCustomerDto.gender) {
      customerData.gender = createCustomerDto.gender;
    }
    if (createCustomerDto.address) {
      customerData.address = createCustomerDto.address;
    }
    if (createCustomerDto.city) {
      customerData.city = createCustomerDto.city;
    }
    if (createCustomerDto.province) {
      customerData.province = createCustomerDto.province;
    }
    if (createCustomerDto.postalCode) {
      customerData.postalCode = createCustomerDto.postalCode;
    }
    if (createCustomerDto.country) {
      customerData.country = createCustomerDto.country;
    }
    if (createCustomerDto.taxId) {
      customerData.taxId = createCustomerDto.taxId;
    }
    if (createCustomerDto.taxName) {
      customerData.taxName = createCustomerDto.taxName;
    }
    if (createCustomerDto.taxAddress) {
      customerData.taxAddress = createCustomerDto.taxAddress;
    }
    if (createCustomerDto.paymentTermDays) {
      customerData.paymentTermDays = createCustomerDto.paymentTermDays;
    }
    if (createCustomerDto.preferredBranchId) {
      customerData.preferredBranchId = createCustomerDto.preferredBranchId;
    }
    if (createCustomerDto.notes) {
      customerData.notes = createCustomerDto.notes;
    }

    // Create customer
    const customer = await this.prisma.customer.create({
      data: customerData,
      include: {
        tier: true,
        preferredBranch: true,
      },
    });

    return {
      id: customer.id,
      customerCode: customer.customerCode,
      customerType: customer.customerType,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      tier: customer.tier
        ? {
            id: customer.tier.id,
            code: customer.tier.code,
            name: customer.tier.name,
          }
        : null,
      creditLimit: customer.creditLimit ? customer.creditLimit.toNumber() : 0,
      creditUsed: customer.creditUsed ? customer.creditUsed.toNumber() : 0,
      createdAt: customer.createdAt,
    };
  }

  /**
   * Update customer
   * @param id - Customer ID
   * @param updateCustomerDto - Customer update data
   * @param _userId - User ID who updated this customer
   * @returns Updated customer
   */
  async update(id: string, updateCustomerDto: UpdateCustomerDto, _userId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Validate email uniqueness if updating
    if (updateCustomerDto.email && updateCustomerDto.email !== customer.email) {
      const existingEmail = await this.prisma.customer.findFirst({
        where: {
          email: updateCustomerDto.email,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (existingEmail) {
        throw new ConflictException('Email already exists');
      }
    }

    // Validate phone uniqueness if updating
    if (updateCustomerDto.phone && updateCustomerDto.phone !== customer.phone) {
      const existingPhone = await this.prisma.customer.findFirst({
        where: {
          phone: updateCustomerDto.phone,
          deletedAt: null,
          id: { not: id },
        },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    // Validate tier if updating
    if (updateCustomerDto.tierId) {
      const tier = await this.prisma.customerTier.findUnique({
        where: { id: updateCustomerDto.tierId },
      });
      if (!tier) {
        throw new NotFoundException('Customer tier not found');
      }
    }

    // Validate preferred branch if updating
    if (updateCustomerDto.preferredBranchId) {
      const branch = await this.prisma.branch.findUnique({
        where: { id: updateCustomerDto.preferredBranchId },
      });
      if (!branch) {
        throw new NotFoundException('Preferred branch not found');
      }
    }

    // Prepare update data
    const updateData: any = {};

    if (updateCustomerDto.customerType !== undefined) {
      updateData.customerType = updateCustomerDto.customerType;
    }
    if (updateCustomerDto.tierId !== undefined) {
      updateData.tierId = updateCustomerDto.tierId || null;
    }
    if (updateCustomerDto.name !== undefined) {
      updateData.name = updateCustomerDto.name;
    }
    if (updateCustomerDto.email !== undefined) {
      updateData.email = updateCustomerDto.email || null;
    }
    if (updateCustomerDto.phone !== undefined) {
      updateData.phone = updateCustomerDto.phone;
    }
    if (updateCustomerDto.alternatePhone !== undefined) {
      updateData.alternatePhone = updateCustomerDto.alternatePhone || null;
    }
    if (updateCustomerDto.dateOfBirth !== undefined) {
      updateData.dateOfBirth = updateCustomerDto.dateOfBirth
        ? new Date(updateCustomerDto.dateOfBirth)
        : null;
    }
    if (updateCustomerDto.gender !== undefined) {
      updateData.gender = updateCustomerDto.gender || null;
    }
    if (updateCustomerDto.address !== undefined) {
      updateData.address = updateCustomerDto.address || null;
    }
    if (updateCustomerDto.city !== undefined) {
      updateData.city = updateCustomerDto.city || null;
    }
    if (updateCustomerDto.province !== undefined) {
      updateData.province = updateCustomerDto.province || null;
    }
    if (updateCustomerDto.postalCode !== undefined) {
      updateData.postalCode = updateCustomerDto.postalCode || null;
    }
    if (updateCustomerDto.country !== undefined) {
      updateData.country = updateCustomerDto.country || null;
    }
    if (updateCustomerDto.taxId !== undefined) {
      updateData.taxId = updateCustomerDto.taxId || null;
    }
    if (updateCustomerDto.taxName !== undefined) {
      updateData.taxName = updateCustomerDto.taxName || null;
    }
    if (updateCustomerDto.taxAddress !== undefined) {
      updateData.taxAddress = updateCustomerDto.taxAddress || null;
    }
    if (updateCustomerDto.creditLimit !== undefined) {
      if (updateCustomerDto.creditLimit < 0) {
        throw new BadRequestException('Credit limit cannot be negative');
      }
      updateData.creditLimit = updateCustomerDto.creditLimit;
    }
    if (updateCustomerDto.paymentTermDays !== undefined) {
      updateData.paymentTermDays = updateCustomerDto.paymentTermDays || null;
    }
    if (updateCustomerDto.preferredBranchId !== undefined) {
      updateData.preferredBranchId = updateCustomerDto.preferredBranchId || null;
    }
    if (updateCustomerDto.notes !== undefined) {
      updateData.notes = updateCustomerDto.notes || null;
    }

    // Update customer
    const updatedCustomer = await this.prisma.customer.update({
      where: { id },
      data: updateData,
      include: {
        tier: true,
        preferredBranch: true,
      },
    });

    return {
      id: updatedCustomer.id,
      customerCode: updatedCustomer.customerCode,
      customerType: updatedCustomer.customerType,
      name: updatedCustomer.name,
      email: updatedCustomer.email,
      phone: updatedCustomer.phone,
      tier: updatedCustomer.tier
        ? {
            id: updatedCustomer.tier.id,
            code: updatedCustomer.tier.code,
            name: updatedCustomer.tier.name,
          }
        : null,
      creditLimit: updatedCustomer.creditLimit ? updatedCustomer.creditLimit.toNumber() : 0,
      creditUsed: updatedCustomer.creditUsed ? updatedCustomer.creditUsed.toNumber() : 0,
      creditAvailable:
        (updatedCustomer.creditLimit ? updatedCustomer.creditLimit.toNumber() : 0) - (updatedCustomer.creditUsed ? updatedCustomer.creditUsed.toNumber() : 0),
      isBlacklisted: updatedCustomer.isBlacklisted,
      isActive: updatedCustomer.isActive,
      updatedAt: updatedCustomer.updatedAt,
    };
  }

  /**
   * Soft delete customer
   * @param id - Customer ID
   * @param _userId - User ID who deleted this customer
   */
  async softDelete(id: string, _userId: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    // Check outstanding balance
    if (customer.creditUsed && customer.creditUsed.toNumber() > 0) {
      throw new BadRequestException(
        `Cannot delete customer with outstanding balance (Rp ${customer.creditUsed.toNumber()}). Please clear balance first.`,
      );
    }

    // TODO: Check transaction history
    // For now, we'll just check credit used

    // Soft delete
    await this.prisma.customer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  /**
   * Get customer statistics
   * @param _customerId - Customer ID
   * @returns Customer statistics
   */
  async getStatistics(_customerId: string): Promise<CustomerStatistics> {
    // TODO: Implement actual transaction aggregation
    // For now, return placeholder data
    // This will be implemented when sales_transactions table is created

    return {
      totalPurchases: 0,
      totalOrders: 0,
      averageOrderValue: 0,
      lastPurchaseDate: null,
      firstPurchaseDate: null,
      lifetimeValue: 0,
    };
  }

  /**
   * Get transaction history
   * @param _customerId - Customer ID
   * @param query - Query parameters
   * @returns Paginated transaction history
   */
  async getTransactionHistory(_customerId: string, query: any) {
    // TODO: Implement when sales_transactions table is created
    return {
      data: [],
      meta: {
        total: 0,
        page: query.page || 1,
        limit: query.limit || 20,
        totalPages: 0,
      },
    };
  }

  /**
   * Check credit limit
   * @param customerId - Customer ID
   * @param amount - Purchase amount
   * @returns True if within limit
   */
  async checkCreditLimit(customerId: string, amount: number): Promise<boolean> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    if (customer.isBlacklisted) {
      throw new ForbiddenException('Customer is blacklisted and cannot make purchases');
    }

    const availableCredit = (customer.creditLimit ? customer.creditLimit.toNumber() : 0) - (customer.creditUsed ? customer.creditUsed.toNumber() : 0);
    return amount <= availableCredit;
  }

  /**
   * Update credit used after transaction
   * @param customerId - Customer ID
   * @param amount - Transaction amount
   */
  async updateCreditUsed(customerId: string, amount: number): Promise<void> {
    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        creditUsed: {
          increment: amount,
        },
      },
    });

    // Check and upgrade tier
    await this.checkAndUpgradeTier(customerId);
  }

  /**
   * Blacklist customer
   * @param customerId - Customer ID
   * @param blacklistDto - Blacklist data
   * @param _userId - User ID who blacklisted
   */
  async blacklistCustomer(
    customerId: string,
    blacklistDto: BlacklistCustomerDto,
    _userId: string,
  ): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        isBlacklisted: true,
        blacklistReason: blacklistDto.reason,
        blacklistUntil: blacklistDto.blacklistUntil
          ? new Date(blacklistDto.blacklistUntil)
          : null,
      },
    });
  }

  /**
   * Remove customer from blacklist
   * @param customerId - Customer ID
   * @param _userId - User ID who removed blacklist
   */
  async removeBlacklist(customerId: string, _userId: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        isBlacklisted: false,
        blacklistReason: null,
        blacklistUntil: null,
      },
    });
  }

  /**
   * Merge duplicate customers
   * @param mergeDto - Merge data
   * @param _userId - User ID who merged
   */
  async mergeDuplicates(mergeDto: MergeCustomersDto, _userId: string): Promise<void> {
    const keepCustomer = await this.prisma.customer.findUnique({
      where: { id: mergeDto.keepId },
    });

    if (!keepCustomer) {
      throw new NotFoundException('Customer to keep not found');
    }

    // Validate all remove customers exist
    const removeCustomers = await this.prisma.customer.findMany({
      where: {
        id: { in: mergeDto.removeIds },
      },
    });

    if (removeCustomers.length !== mergeDto.removeIds.length) {
      throw new NotFoundException('One or more customers to remove not found');
    }

    // TODO: Implement merge logic
    // 1. Transfer transactions from remove customers to keep customer
    // 2. Merge credit balances
    // 3. Update references
    // 4. Soft delete remove customers

    // For now, just soft delete remove customers
    await this.prisma.customer.updateMany({
      where: {
        id: { in: mergeDto.removeIds },
      },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }
}

