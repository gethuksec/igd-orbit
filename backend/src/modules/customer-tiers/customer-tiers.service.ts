import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../shared/services";
import { CreateCustomerTierDto, UpdateCustomerTierDto } from "./dto";

/**
 * CustomerTiers Service
 * Handles customer tier management operations
 */
@Injectable()
export class CustomerTiersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find all customer tiers
   * @returns List of customer tiers
   */
  async findAll() {
    return this.prisma.customerTier.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
    });
  }

  /**
   * Find all customer tiers with pagination
   * @param page - Page number (1-based)
   * @param limit - Items per page
   * @param search - Search term for name/code
   * @param isActive - Filter by active status (optional)
   * @returns Paginated list
   */
  async findAllPaginated(
    page: number = 1,
    limit: number = 20,
    search?: string,
    isActive?: boolean,
    status?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    // Apply status filter (new style)
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    } else if (status === 'all') {
      // Show all records - no filter
    } else if (isActive !== undefined) {
      // Backward compat: use old isActive boolean param
      where.isActive = isActive;
    } else {
      // Default: active only (backward compatible)
      where.isActive = true;
    }

    if (search && search.trim().length > 0) {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { code: { contains: search.trim(), mode: "insensitive" } },
        {
          description: { contains: search.trim(), mode: "insensitive" },
        },
      ];
    }

    const [tiers, total] = await Promise.all([
      this.prisma.customerTier.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              customers: true,
            },
          },
        },
      }),
      this.prisma.customerTier.count({ where }),
    ]);

    return {
      data: tiers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find customer tier by ID
   * @param id - Customer tier ID
   * @returns Customer tier with customer count
   */
  async findById(id: string) {
    const tier = await this.prisma.customerTier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
    });

    if (!tier) {
      throw new NotFoundException("Customer tier not found");
    }

    return tier;
  }

  /**
   * Create new customer tier
   * @param createCustomerTierDto - Customer tier creation data
   * @returns Created customer tier
   */
  async create(createCustomerTierDto: CreateCustomerTierDto) {
    const { discountPercentage, creditLimit, minPurchaseAmount, ...rest } =
      createCustomerTierDto;

    // Generate code if not provided
    let code = rest.code;
    if (!code) {
      code = await this.generateCode();
    } else {
      const existing = await this.prisma.customerTier.findUnique({
        where: { code },
      });
      if (existing) {
        throw new ConflictException("Customer tier code already exists");
      }
    }

    const tier = await this.prisma.customerTier.create({
      data: {
        ...rest,
        code,
        discountPercentage: parseFloat(discountPercentage.toString()),
        creditLimit: creditLimit !== undefined ? parseFloat(creditLimit.toString()) : 0,
        minPurchaseAmount: minPurchaseAmount
          ? parseFloat(minPurchaseAmount.toString())
          : null,
      },
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
    });

    return tier;
  }

  /**
   * Update customer tier
   * @param id - Customer tier ID
   * @param updateCustomerTierDto - Customer tier update data
   * @returns Updated customer tier
   */
  async update(id: string, updateCustomerTierDto: UpdateCustomerTierDto) {
    const existing = await this.prisma.customerTier.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException("Customer tier not found");
    }

    const { discountPercentage, creditLimit, minPurchaseAmount, ...rest } =
      updateCustomerTierDto;

    // Prepare update data
    const updateData: any = { ...rest };

    if (discountPercentage !== undefined) {
      updateData.discountPercentage = parseFloat(discountPercentage.toString());
    }
    if (creditLimit !== undefined) {
      updateData.creditLimit = parseFloat(creditLimit.toString());
    }
    if (minPurchaseAmount !== undefined) {
      updateData.minPurchaseAmount =
        minPurchaseAmount !== null
          ? parseFloat(minPurchaseAmount.toString())
          : null;
    }

    // Check code uniqueness if updating
    if (rest.code && rest.code !== existing.code) {
      const codeExists = await this.prisma.customerTier.findUnique({
        where: { code: rest.code },
      });
      if (codeExists) {
        throw new ConflictException("Customer tier code already exists");
      }
    }

    const updated = await this.prisma.customerTier.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
    });

    return updated;
  }

  /**
   * Delete customer tier
   * @param id - Customer tier ID
   */
  async delete(id: string): Promise<void> {
    const tier = await this.prisma.customerTier.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            customers: true,
          },
        },
      },
    });

    if (!tier) {
      throw new NotFoundException("Customer tier not found");
    }

    // Check if has customers
    if (tier._count.customers > 0) {
      throw new ConflictException(
        `Cannot delete customer tier with ${tier._count.customers} customer(s). Please remove or reassign customers first.`,
      );
    }

    await this.prisma.customerTier.delete({
      where: { id },
    });
  }

  /**
   * Generate unique customer tier code
   * Format: TIER-{random}
   * @returns Generated code string
   */
  private async generateCode(): Promise<string> {
    const { randomBytes } = await import("crypto");
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const random = randomBytes(4).toString("hex").toUpperCase();
      code = `TIER-${random}`;

      const existing = await this.prisma.customerTier.findUnique({
        where: { code },
      });

      if (!existing) {
        isUnique = true;
      }

      attempts++;
    }

    if (!isUnique) {
      throw new ConflictException(
        "Failed to generate unique code after multiple attempts",
      );
    }

    return code!;
  }
}
