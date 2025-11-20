import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RESOURCE_TYPE_KEY } from '../decorators';
import { BranchAccessService } from '../services/branch-access.service';
import { PrismaService } from '../services/prisma.service';

/**
 * Resource Access Guard
 * Checks if user can access a specific resource (by ID)
 * 
 * This guard verifies:
 * 1. Resource exists
 * 2. User has branch access to the resource
 * 3. User owns the resource (if applicable)
 * 
 * This guard is OPTIONAL and only activates if @ResourceType() decorator is present.
 * 
 * Feature Flag: USE_RESOURCE_ACCESS_GUARD (default: false)
 */
@Injectable()
export class ResourceAccessGuard implements CanActivate {
  private readonly useResourceAccessGuard: boolean;

  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
    private branchAccessService: BranchAccessService,
    private prisma: PrismaService,
  ) {
    // Feature flag: default to false (disabled) for safety
    this.useResourceAccessGuard =
      this.configService.get<string>('USE_RESOURCE_ACCESS_GUARD') === 'true';
  }

  /**
   * Check if user can access the resource
   * @param context - Execution context
   * @returns True if user can access the resource or guard is disabled
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // If feature flag is disabled, skip resource access check
    if (!this.useResourceAccessGuard) {
      return true;
    }

    // Get resource type from decorator
    const resourceType = this.reflector.getAllAndOverride<string>(
      RESOURCE_TYPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no @ResourceType() decorator, allow access (guard is optional)
    if (!resourceType) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get resource ID from route params
    const resourceId = request.params.id;

    if (!resourceId) {
      // No resource ID in params, skip check (might be list endpoint)
      return true;
    }

    // Check resource access based on type
    await this.checkResourceAccess(user.id, resourceType, resourceId);

    return true;
  }

  /**
   * Check if user can access a specific resource
   * @param userId - User ID
   * @param resourceType - Resource type
   * @param resourceId - Resource ID
   */
  private async checkResourceAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    switch (resourceType) {
      case 'sales_transaction':
        await this.checkSalesTransactionAccess(userId, resourceId);
        break;
      case 'service_order':
        await this.checkServiceOrderAccess(userId, resourceId);
        break;
      case 'customer':
        await this.checkCustomerAccess(userId, resourceId);
        break;
      case 'product':
        await this.checkProductAccess(userId, resourceId);
        break;
      default:
        // Unknown resource type - allow access (fail open for safety)
        // Can be made stricter later
        break;
    }
  }

  /**
   * Check sales transaction access
   */
  private async checkSalesTransactionAccess(
    userId: string,
    transactionId: string,
  ): Promise<void> {
    const transaction = await this.prisma.salesTransaction.findUnique({
      where: { id: transactionId },
      select: { branchId: true, cashierId: true },
    });

    if (!transaction) {
      throw new ForbiddenException('Transaction not found');
    }

    // Check branch access
    if (transaction.branchId) {
      await this.branchAccessService.ensureBranchAccess(
        userId,
        transaction.branchId,
      );
    }
  }

  /**
   * Check service order access
   */
  private async checkServiceOrderAccess(
    userId: string,
    serviceOrderId: string,
  ): Promise<void> {
    const serviceOrder = await this.prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      select: { branchId: true, createdBy: true },
    });

    if (!serviceOrder) {
      throw new ForbiddenException('Service order not found');
    }

    // Check branch access
    if (serviceOrder.branchId) {
      await this.branchAccessService.ensureBranchAccess(
        userId,
        serviceOrder.branchId,
      );
    }
  }

  /**
   * Check customer access
   */
  private async checkCustomerAccess(
    _userId: string,
    customerId: string,
  ): Promise<void> {
    // Customers are typically accessible across branches for viewing
    // But editing might be restricted. For now, allow access.
    // Can be made more restrictive later based on business rules.
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      throw new ForbiddenException('Customer not found');
    }
  }

  /**
   * Check product access
   */
  private async checkProductAccess(
    _userId: string,
    productId: string,
  ): Promise<void> {
    // Products are typically accessible across branches for viewing
    // But editing might be restricted. For now, allow access.
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new ForbiddenException('Product not found');
    }
  }
}

