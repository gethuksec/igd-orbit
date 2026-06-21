import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services';
import { buildPerWordSearch } from '../../shared/services/search.utils';
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
   * Get all active customer tiers
   * @returns List of active tiers
   */
  async getActiveTiers() {
    return this.prisma.customerTier.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        discountPercentage: true,
        minPurchaseAmount: true,
      },
      orderBy: { name: 'asc' },
    });
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
      sort = 'createdAt',
    } = query;

    // Ensure page and limit are numbers (fallback if transform didn't work)
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;

    const skip = (pageNum - 1) * limitNum;
    const where: Prisma.CustomerWhereInput = {
      deletedAt: filterStatus === 'active' ? null : { not: null },
    };

    // Search filter - per-word AND search across fields
    if (search) {
      where.AND = buildPerWordSearch(search, [
        'name',
        'customerCode',
        'email',
        'phone',
        'subdistrict',
      ]);
    }

    // Tier filter - support both tier IDs and tier codes
    if (filterTier && filterTier.length > 0) {
      // Check if filterTier contains tier codes (REGULAR, GOLD, etc) or IDs
      const tierCodes = filterTier.filter((t) => ['REGULAR', 'SILVER', 'GOLD', 'PLATINUM', 'USER'].includes(t.toUpperCase()));
      const tierIds = filterTier.filter((t) => !['REGULAR', 'SILVER', 'GOLD', 'PLATINUM', 'USER'].includes(t.toUpperCase()));
      
      if (tierCodes.length > 0) {
        // Find tier IDs by codes
        const tiers = await this.prisma.customerTier.findMany({
          where: { code: { in: tierCodes.map((c) => c.toUpperCase()) } },
          select: { id: true },
        });
        const foundTierIds = tiers.map((t) => t.id);
        const allTierIds = [...tierIds, ...foundTierIds];
        
        if (allTierIds.length > 0) {
          where.tierId = { in: allTierIds };
        }
      } else if (tierIds.length > 0) {
        where.tierId = { in: tierIds };
      }
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

    // Determine sort field and order - only 'name' or 'createdAt' allowed (validated in DTO)
    const order = query.order || 'desc';
    let orderBy: Prisma.CustomerOrderByWithRelationInput;
    if (sort === 'name') {
      orderBy = { name: order };
    } else {
      // Default: createdAt
      orderBy = { createdAt: order };
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
            address: customer.address,
            city: customer.city,
            province: customer.province,
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

    // Validate tier if provided - support both tierId and tierCode
    let tierId: string | null = null;
    if (createCustomerDto.tierId) {
      const tier = await this.prisma.customerTier.findUnique({
        where: { id: createCustomerDto.tierId },
      });
      if (!tier) {
        throw new NotFoundException('Customer tier not found');
      }
      tierId = createCustomerDto.tierId;
    } else if ((createCustomerDto as any).tierCode) {
      // Support tier code lookup
      const tier = await this.prisma.customerTier.findUnique({
        where: { code: (createCustomerDto as any).tierCode.toUpperCase() },
      });
      if (tier) {
        tierId = tier.id;
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

    if (tierId) {
      customerData.tierId = tierId;
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
    if (createCustomerDto.subdistrict) {
      customerData.subdistrict = createCustomerDto.subdistrict;
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
    if (createCustomerDto.religion) {
      customerData.religion = createCustomerDto.religion;
    }
    if (createCustomerDto.idType) {
      customerData.idType = createCustomerDto.idType;
    }
    if (createCustomerDto.idNumber) {
      customerData.idNumber = createCustomerDto.idNumber;
    }
    if (createCustomerDto.taxId) {
      customerData.taxId = createCustomerDto.taxId;
    }
    if (createCustomerDto.taxName) {
      customerData.taxName = createCustomerDto.taxName;
    }
    if (createCustomerDto.taxIdType) {
      customerData.taxIdType = createCustomerDto.taxIdType;
    }
    if (createCustomerDto.taxAddress) {
      customerData.taxAddress = createCustomerDto.taxAddress;
    }
    if (createCustomerDto.idTKU) {
      customerData.idTKU = createCustomerDto.idTKU;
    }
    if (createCustomerDto.taxTransactionDetail) {
      customerData.taxTransactionDetail = createCustomerDto.taxTransactionDetail;
    }
    if (createCustomerDto.creditLimitNoteCount !== undefined) {
      customerData.creditLimitNoteCount = createCustomerDto.creditLimitNoteCount;
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

    // Validate tier if updating - support both tierId and tierCode
    let tierId: string | null | undefined = undefined;
    if (updateCustomerDto.tierId !== undefined) {
      if (updateCustomerDto.tierId) {
        const tier = await this.prisma.customerTier.findUnique({
          where: { id: updateCustomerDto.tierId },
        });
        if (!tier) {
          throw new NotFoundException('Customer tier not found');
        }
        tierId = updateCustomerDto.tierId;
      } else {
        tierId = null;
      }
    } else if ((updateCustomerDto as any).tierCode !== undefined) {
      // Support tier code lookup
      const tierCode = (updateCustomerDto as any).tierCode;
      if (tierCode) {
        const tier = await this.prisma.customerTier.findUnique({
          where: { code: tierCode.toUpperCase() },
        });
        if (tier) {
          tierId = tier.id;
        } else {
          tierId = null;
        }
      } else {
        tierId = null;
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
    if (tierId !== undefined) {
      updateData.tierId = tierId;
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
    if (updateCustomerDto.subdistrict !== undefined) {
      updateData.subdistrict = updateCustomerDto.subdistrict || null;
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
    if (updateCustomerDto.religion !== undefined) {
      updateData.religion = updateCustomerDto.religion || null;
    }
    if (updateCustomerDto.idType !== undefined) {
      updateData.idType = updateCustomerDto.idType || null;
    }
    if (updateCustomerDto.idNumber !== undefined) {
      updateData.idNumber = updateCustomerDto.idNumber || null;
    }
    if (updateCustomerDto.taxId !== undefined) {
      updateData.taxId = updateCustomerDto.taxId || null;
    }
    if (updateCustomerDto.taxName !== undefined) {
      updateData.taxName = updateCustomerDto.taxName || null;
    }
    if (updateCustomerDto.taxIdType !== undefined) {
      updateData.taxIdType = updateCustomerDto.taxIdType || null;
    }
    if (updateCustomerDto.taxAddress !== undefined) {
      updateData.taxAddress = updateCustomerDto.taxAddress || null;
    }
    if (updateCustomerDto.idTKU !== undefined) {
      updateData.idTKU = updateCustomerDto.idTKU || null;
    }
    if (updateCustomerDto.taxTransactionDetail !== undefined) {
      updateData.taxTransactionDetail = updateCustomerDto.taxTransactionDetail || null;
    }
    if (updateCustomerDto.creditLimitNoteCount !== undefined) {
      updateData.creditLimitNoteCount = updateCustomerDto.creditLimitNoteCount || null;
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
   * Get overall customer statistics (for dashboard cards)
   * @returns Overall customer statistics
   */
  async getOverallStatistics() {
    const totalCustomers = await this.prisma.customer.count({
      where: {
        deletedAt: null,
        isActive: true,
      },
    });

    // Get tier counts
    const customersWithTiers = await this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      include: {
        tier: true,
      },
    });

    const goldPlatinumCount = customersWithTiers.filter(
      (c) => c.tier && (c.tier.code === 'GOLD' || c.tier.code === 'PLATINUM'),
    ).length;

    const regularSilverCount = customersWithTiers.filter(
      (c) => c.tier && (c.tier.code === 'REGULAR' || c.tier.code === 'SILVER'),
    ).length;

    return {
      total: totalCustomers,
      goldPlatinum: goldPlatinumCount,
      regularSilver: regularSilverCount,
    };
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
  async getTransactionHistory(customerId: string, query: any) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const pageNum = typeof page === 'string' ? parseInt(page, 10) : page || 1;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit || 20;
    const skip = (pageNum - 1) * limitNum;

    // Get sales transactions (include void/cancelled to show return history)
    const [salesTransactions, salesCount] = await Promise.all([
      this.prisma.salesTransaction.findMany({
        where: {
          customerId,
          // Include all transactions including void/cancelled to show return history
        },
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          transactionNumber: true,
          transactionType: true,
          status: true,
          total: true,
          paymentStatus: true,
          createdAt: true,
          branch: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      }),
      this.prisma.salesTransaction.count({
        where: {
          customerId,
          // Include all transactions including void/cancelled
        },
      }),
    ]);

    // Get customer phone number for matching
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { phone: true, alternatePhone: true },
    });

    // Build service order where clause: match by customerId OR by phone number (for walk-in customers)
    const serviceOrderWhere: any = {
      status: { not: 'cancelled' }, // Exclude cancelled orders
      OR: [
        { customerId }, // Direct customer link
      ],
    };

    // If customer has phone, also match service orders by phone number (for walk-in customers that were later registered)
    if (customer?.phone) {
      serviceOrderWhere.OR.push({
        customerId: null, // Only match walk-in orders
        customerPhone: customer.phone,
      });
    }
    if (customer?.alternatePhone) {
      serviceOrderWhere.OR.push({
        customerId: null, // Only match walk-in orders
        customerPhone: customer.alternatePhone,
      });
    }

    // Get service orders
    const [serviceOrders, serviceCount] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where: serviceOrderWhere,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          serviceNumber: true,
          status: true,
          totalPrice: true,
          paymentStatus: true,
          createdAt: true,
          branch: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      }),
      this.prisma.serviceOrder.count({
        where: serviceOrderWhere,
      }),
    ]);

    // Combine and sort by date
    const allTransactions = [
      ...salesTransactions.map((tx) => ({
        id: tx.id,
        type: 'sales',
        referenceNumber: tx.transactionNumber,
        status: tx.status,
        totalAmount: tx.total.toNumber(),
        paymentStatus: tx.paymentStatus,
        branch: tx.branch,
        createdAt: tx.createdAt,
      })),
      ...serviceOrders.map((so) => ({
        id: so.id,
        type: 'service',
        referenceNumber: so.serviceNumber,
        status: so.status,
        totalAmount: so.totalPrice ? so.totalPrice.toNumber() : 0,
        paymentStatus: so.paymentStatus,
        branch: so.branch,
        createdAt: so.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limitNum);

    return {
      data: allTransactions,
      meta: {
        total: salesCount + serviceCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((salesCount + serviceCount) / limitNum),
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

  /**
   * Import customers from CSV
   * @param csvContent - CSV file content as string
   * @param userId - User ID who imported
   */
  async importFromCSV(csvContent: string, userId: string): Promise<{
    success: number;
    updated: number;
    created: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    const lines = csvContent.split('\n').filter((line) => line.trim());
    if (lines.length < 2) {
      throw new BadRequestException('CSV file is empty or invalid');
    }

    // Detect delimiter (semicolon or comma)
    const firstLine = lines[0];
    const isSemicolonDelimited = firstLine.includes(';') && firstLine.split(';').length > firstLine.split(',').length;
    const delimiter = isSemicolonDelimited ? ';' : ',';

    // Parse header
    const headers = this.parseCSVLine(lines[0], delimiter);
    const headerMap: Record<string, number> = {};
    headers.forEach((h, i) => {
      headerMap[h.toLowerCase().trim()] = i;
    });

    // Validate required headers (name and phone in any language)
    const hasName = headerMap['nama'] !== undefined || headerMap['name'] !== undefined;
    const hasPhone = headerMap['telepon'] !== undefined || headerMap['phone'] !== undefined;
    
    if (!hasName) {
      throw new BadRequestException('Required column "Nama" or "Name" not found in CSV');
    }
    if (!hasPhone) {
      throw new BadRequestException('Required column "Telepon" or "Phone" not found in CSV');
    }

    const results = {
      success: 0,
      updated: 0,
      created: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string }>,
    };

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = this.parseCSVLine(line, delimiter);
        const rowData: any = {};
        headers.forEach((header, index) => {
          const value = values[index]?.trim() || '';
          rowData[header.toLowerCase().trim()] = value;
        });

        // Map CSV columns to DTO - support both Indonesian and English column names
        const customerData: any = {
          customerType: rowData['jenis_pelanggan'] || rowData['customer_type'] || rowData['customertype'] || 'retail',
          name: rowData['nama'] || rowData['name'] || '',
          phone: rowData['telepon'] || rowData['phone'] || '',
          email: rowData['email'] || undefined,
          alternatePhone: rowData['no_hp'] || rowData['alternate_phone'] || rowData['alternatephone'] || undefined,
          dateOfBirth: rowData['tanggal_lahir(dd/mm/yyyy)'] || rowData['tanggal_lahir'] || rowData['date_of_birth'] || rowData['dateofbirth'] || undefined,
          gender: rowData['jenis_kelamin(l/p)'] || rowData['jenis_kelamin'] || rowData['gender'] || undefined,
          address: rowData['alamat'] || rowData['address'] || undefined,
          subdistrict: rowData['kecamatan'] || rowData['subdistrict'] || undefined,
          city: rowData['kota'] || rowData['city'] || undefined,
          province: rowData['provinsi'] || rowData['province'] || undefined,
          postalCode: rowData['kode_pos'] || rowData['postal_code'] || rowData['postalcode'] || undefined,
          country: rowData['negara'] || rowData['country'] || 'Indonesia',
          religion: rowData['agama'] || rowData['religion'] || undefined,
          idType: rowData['jenis_identitas'] || rowData['id_type'] || rowData['idtype'] || undefined,
          idNumber: rowData['nomor_identitas'] || rowData['id_number'] || rowData['idnumber'] || undefined,
          taxId: rowData['no_npwp/ktp'] || rowData['npwp'] || rowData['tax_id'] || rowData['taxid'] || undefined,
          taxName: rowData['nama_(pajak)'] || rowData['nama_pajak'] || rowData['tax_name'] || rowData['taxname'] || undefined,
          taxIdType: rowData['jenis_identitas_pajak_(npwp/ktp)'] || rowData['jenis_identitas_pajak'] || rowData['tax_id_type'] || rowData['taxidtype'] || undefined,
          taxAddress: rowData['alamat_(pajak)'] || rowData['alamat_pajak'] || rowData['tax_address'] || rowData['taxaddress'] || undefined,
          idTKU: rowData['idtku'] || rowData['id_tku'] || undefined,
          taxTransactionDetail: rowData['detail_transaksi_pajak_(01/02/03..dst)'] || rowData['detail_transaksi_pajak'] || rowData['tax_transaction_detail'] || rowData['taxtransactiondetail'] || undefined,
          creditLimit: rowData['plafon_nilai'] || rowData['plafon'] || rowData['credit_limit'] || rowData['creditlimit'] ? parseFloat(rowData['plafon_nilai'] || rowData['plafon'] || rowData['credit_limit'] || rowData['creditlimit']) || 0 : 0,
          creditLimitNoteCount: rowData['plafon_jumlah_nota'] || rowData['credit_limit_note_count'] || rowData['creditlimitnotecount'] ? parseInt(rowData['plafon_jumlah_nota'] || rowData['credit_limit_note_count'] || rowData['creditlimitnotecount']) || 0 : 0,
          paymentTermDays: rowData['termin_pembayaran'] || rowData['payment_term_days'] || rowData['paymenttermdays'] ? parseInt(rowData['termin_pembayaran'] || rowData['payment_term_days'] || rowData['paymenttermdays']) || 0 : 0,
          notes: rowData['keterangan'] || rowData['notes'] || undefined,
        };

        // Handle tier - support both tier code and tier name, also kategori pelanggan
        const tierValue = rowData['kategori_pelanggan'] || rowData['tier'] || rowData['tier_code'] || rowData['tiercode'];
        if (tierValue) {
          const tierUpper = tierValue.toUpperCase();
          const tier = await this.prisma.customerTier.findFirst({
            where: {
              OR: [
                { code: tierUpper },
                { name: { contains: tierUpper, mode: 'insensitive' } },
              ],
            },
          });
          if (tier) {
            customerData.tierCode = tier.code;
          }
        }

        // Handle date format conversion (dd/mm/yyyy to ISO)
        if (customerData.dateOfBirth) {
          const dateMatch = customerData.dateOfBirth.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (dateMatch) {
            const [, day, month, year] = dateMatch;
            customerData.dateOfBirth = `${year}-${month}-${day}`;
          }
        }

        // Handle gender conversion (L/P to L/P)
        if (customerData.gender) {
          const genderUpper = customerData.gender.toUpperCase();
          if (genderUpper === 'L' || genderUpper === 'LAKI-LAKI' || genderUpper === 'MALE') {
            customerData.gender = 'L';
          } else if (genderUpper === 'P' || genderUpper === 'PEREMPUAN' || genderUpper === 'FEMALE') {
            customerData.gender = 'P';
          }
        }

        // Validate required fields
        if (!customerData.name || !customerData.phone) {
          throw new BadRequestException('Nama dan Telepon wajib diisi');
        }

        // Check for duplicate phone - if exists, update instead of create
        const existing = await this.prisma.customer.findFirst({
          where: {
            phone: customerData.phone,
            deletedAt: null,
          },
        });

        if (existing) {
          // Update existing customer with new data from CSV
          await this.update(existing.id, customerData, userId);
          results.updated++;
          results.success++;
        } else {
          // Create new customer
          await this.create(customerData, userId);
          results.created++;
          results.success++;
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          row: i + 1,
          error: error.message || 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Parse CSV line handling quoted values
   */
  private parseCSVLine(line: string, delimiter: string = ','): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Export customers to CSV
   * @param query - Filter query
   */
  async exportToCSV(query: ListCustomersDto): Promise<string> {
    const customers = await this.findAll(query);
    const data = customers.data || [];

    // CSV Headers based on template (semicolon-separated to match template)
    const headers = [
      'Kode',
      'Nama',
      'Telepon',
      'No HP',
      'Email',
      'Alamat',
      'Tanggal Lahir(dd/mm/yyyy)',
      'Jenis Kelamin(L/P)',
      'Kategori Pelanggan',
      'Jenis Pelanggan',
      'Plafon Nilai',
      'Plafon Jumlah Nota',
      'Negara',
      'Provinsi',
      'Kota',
      'Kecamatan',
      'Agama',
      'Jenis Identitas',
      'Nomor Identitas',
      'Nama (Pajak)',
      'Jenis Identitas Pajak (NPWP/KTP)',
      'No NPWP/KTP',
      'IDTKU',
      'Detail Transaksi Pajak (01/02/03..dst)',
      'Alamat (Pajak)',
      'Keterangan',
      'Status',
    ];

    // Build CSV content (semicolon-separated)
    const csvLines = [headers.join(';')];

    for (const customer of data) {
      // Format date as dd/mm/yyyy
      let formattedDate = '';
      if ((customer as any).dateOfBirth) {
        const date = new Date((customer as any).dateOfBirth);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        formattedDate = `${day}/${month}/${year}`;
      }

      const row = [
        customer.customerCode || '',
        this.escapeCSV(customer.name || '', ';'),
        this.escapeCSV(customer.phone || '', ';'),
        this.escapeCSV((customer as any).alternatePhone || '', ';'),
        this.escapeCSV(customer.email || '', ';'),
        this.escapeCSV((customer as any).address || '', ';'),
        formattedDate,
        (customer as any).gender || '',
        typeof customer.tier === 'object' && customer.tier ? customer.tier.name : '',
        customer.customerType || '',
        customer.creditLimit ? customer.creditLimit.toString() : '0',
        (customer as any).creditLimitNoteCount || '0',
        (customer as any).country || 'Indonesia',
        this.escapeCSV((customer as any).province || '', ';'),
        this.escapeCSV((customer as any).city || '', ';'),
        this.escapeCSV((customer as any).subdistrict || '', ';'),
        (customer as any).religion || '',
        (customer as any).idType || '',
        this.escapeCSV((customer as any).idNumber || '', ';'),
        this.escapeCSV((customer as any).taxName || '', ';'),
        (customer as any).taxIdType || '',
        this.escapeCSV((customer as any).taxId || '', ';'),
        (customer as any).idTKU || '',
        (customer as any).taxTransactionDetail || '',
        this.escapeCSV((customer as any).taxAddress || '', ';'),
        this.escapeCSV((customer as any).notes || '', ';'),
        customer.isActive ? 'Aktif' : 'Tidak Aktif',
      ];
      csvLines.push(row.join(';'));
    }

    return csvLines.join('\n');
  }

  /**
   * Escape CSV value
   */
  private escapeCSV(value: string, delimiter: string = ','): string {
    if (!value) return '';
    // If value contains delimiter, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(delimiter) || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

