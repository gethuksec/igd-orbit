import { SetMetadata } from '@nestjs/common';

/**
 * Resource Type metadata key
 */
export const RESOURCE_TYPE_KEY = 'resourceType';

/**
 * Resource Type Decorator
 * Used to specify the resource type for resource access checking
 * 
 * This decorator is used with ResourceAccessGuard to determine
 * how to check if user can access a specific resource.
 * 
 * @param resourceType - Resource type (e.g., 'sales_transaction', 'service_order', 'customer')
 * @returns Custom decorator
 * 
 * @example
 * @ResourceType('sales_transaction')
 * @Get(':id')
 * async getTransaction(@Param('id') id: string) { ... }
 */
export const ResourceType = (resourceType: string) =>
  SetMetadata(RESOURCE_TYPE_KEY, resourceType);

