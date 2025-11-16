import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { ServiceTypesService } from '../service/service-types.service';
import { ServiceOrdersService } from '../service/service-orders.service';
import { PrismaService } from '../../shared/services/prisma.service';
import { Public } from '../../shared/decorators/public.decorator';

/**
 * Public API Controller
 * Groups all public endpoints under /public prefix
 * No authentication required for these endpoints
 */
@Public()
@Controller('public')
export class PublicController {
  constructor(
    private readonly serviceTypesService: ServiceTypesService,
    private readonly serviceOrdersService: ServiceOrdersService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get all active service types
   * GET /api/v1/public/service-types
   */
  @Get('service-types')
  async getServiceTypes() {
    try {
      return await this.serviceTypesService.findAll();
    } catch (error: any) {
      throw new HttpException(
        error?.message || 'Failed to fetch service types',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get service type by ID
   * GET /api/v1/public/service-types/:id
   */
  @Get('service-types/:id')
  async getServiceTypeById(@Param('id') id: string) {
    return this.serviceTypesService.findById(id);
  }

  /**
   * Get all active branches
   * GET /api/v1/public/branches
   */
  @Get('branches')
  async getBranches() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        province: true,
        operatingHours: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get branch by ID
   * GET /api/v1/public/branches/:id
   */
  @Get('branches/:id')
  async getBranchById(@Param('id') id: string) {
    return this.prisma.branch.findUnique({
      where: { id, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        city: true,
        province: true,
        operatingHours: true,
      },
    });
  }

  /**
   * Track service by service number
   * GET /api/v1/public/service-tracking/:serviceNumber
   */
  @Get('service-tracking/:serviceNumber')
  async trackService(@Param('serviceNumber') serviceNumber: string) {
    try {
      return await this.serviceOrdersService.trackService(serviceNumber);
    } catch (error: any) {
      throw new HttpException(
        error?.message || 'Failed to track service',
        error?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get most popular products based on sales transactions (public, read‑only)
   * GET /api/v1/public/popular-products
   */
  @Get('popular-products')
  async getPopularProducts() {
    // Ambil semua item transaksi beserta produk terkait, lalu agregasi di memory.
    const items = await this.prisma.salesTransactionItem.findMany({
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            sellingPrice: true,
            brand: { select: { name: true } },
            category: { select: { name: true } },
          },
        },
      },
    });

    const map = new Map<
      string,
      {
        id: string;
        name: string;
        sku: string;
        sellingPrice: number;
        brandName?: string | null;
        categoryName?: string | null;
        totalSold: number;
        totalRevenue: number;
      }
    >();

    for (const item of items) {
      if (!item.product) continue;
      const key = item.product.id;
      const quantity = Number(item.quantity ?? 0);
      const unitPrice = Number(item.unitPrice ?? 0);

      if (!map.has(key)) {
        map.set(key, {
          id: item.product.id,
          name: item.product.name,
          sku: item.product.sku,
          sellingPrice: Number(item.product.sellingPrice ?? 0),
          brandName: item.product.brand?.name ?? null,
          categoryName: item.product.category?.name ?? null,
          totalSold: 0,
          totalRevenue: 0,
        });
      }

      const agg = map.get(key)!;
      agg.totalSold += quantity;
      agg.totalRevenue += quantity * unitPrice;
    }

    const result = Array.from(map.values())
      .filter((p) => p.totalSold > 0)
      .sort((a, b) => b.totalSold - a.totalSold)
      .slice(0, 10);

    return result;
  }
}

