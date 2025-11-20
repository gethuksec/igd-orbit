import { SetMetadata } from '@nestjs/common';

/**
 * Permissions metadata key
 */
export const PERMISSIONS_KEY = 'permissions';

/**
 * Permissions Decorator
 * Used to specify required permissions for route access
 * 
 * Supports:
 * - Exact match: 'sales.pos.create'
 * - Wildcard module: 'sales.*.create'
 * - Wildcard submodule: 'sales.pos.*'
 * - Multiple permissions (OR logic): ['sales.pos.create', 'sales.pos.view']
 * 
 * @param permissions - Array of permission strings (e.g., ['sales.pos.create', 'sales.pos.view'])
 * @returns Custom decorator
 * 
 * @example
 * @Permissions('sales.pos.create')
 * @Post('transactions')
 * async createTransaction() { ... }
 * 
 * @example
 * @Permissions('sales.*.create', 'sales.*.view')
 * @Get('transactions')
 * async getTransactions() { ... }
 */
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

