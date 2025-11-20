import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mock the feature flag function
const mockGetUsePermissionHooks = vi.fn(() => false);

vi.mock('./usePermissions', async () => {
  const actual = await vi.importActual('./usePermissions');
  return {
    ...actual,
    getUsePermissionHooks: () => mockGetUsePermissionHooks(),
  };
});

// Import after mock
import { usePermissions } from './usePermissions';

describe('usePermissions', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetUsePermissionHooks.mockReturnValue(false);
  });

  describe('Feature Flag Disabled (Default)', () => {
    it('should return true for all permission checks when feature flag is disabled', () => {
      // Feature flag returns false (default)
      const { result } = renderHook(() => usePermissions());

      expect(result.current.hasPermission('sales.pos.create')).toBe(true);
      expect(result.current.hasAnyPermission(['sales.pos.create', 'sales.pos.delete'])).toBe(true);
      expect(result.current.hasAllPermissions(['sales.pos.create', 'sales.pos.delete'])).toBe(true);
    });
  });

  describe('Feature Flag Enabled', () => {
    beforeEach(() => {
      // Mock feature flag to return true
      mockGetUsePermissionHooks.mockReturnValue(true);
    });

    it('should return false when user has no permissions', () => {
      localStorage.setItem('user', JSON.stringify({ id: '1', name: 'Test User' }));

      const { result } = renderHook(() => usePermissions());

      expect(result.current.hasPermission('sales.pos.create')).toBe(false);
      expect(result.current.hasAnyPermission(['sales.pos.create'])).toBe(false);
    });

    it('should return true for exact permission match', () => {
      const user = {
        id: '1',
        name: 'Test User',
        permissions: ['sales.pos.create', 'sales.pos.view'],
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => usePermissions());

      expect(result.current.hasPermission('sales.pos.create')).toBe(true);
      expect(result.current.hasPermission('sales.pos.view')).toBe(true);
      expect(result.current.hasPermission('sales.pos.delete')).toBe(false);
    });

    it('should support wildcard permissions (module.*.action)', () => {
      const user = {
        id: '1',
        name: 'Test User',
        permissions: ['sales.*.create'],
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => usePermissions());

      expect(result.current.hasPermission('sales.pos.create')).toBe(true);
      expect(result.current.hasPermission('sales.returns.create')).toBe(true);
      expect(result.current.hasPermission('sales.pos.view')).toBe(false);
    });

    it('should support wildcard permissions (module.submodule.*)', () => {
      const user = {
        id: '1',
        name: 'Test User',
        permissions: ['sales.pos.*'],
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => usePermissions());

      expect(result.current.hasPermission('sales.pos.create')).toBe(true);
      expect(result.current.hasPermission('sales.pos.view')).toBe(true);
      expect(result.current.hasPermission('sales.pos.delete')).toBe(true);
      expect(result.current.hasPermission('sales.returns.create')).toBe(false);
    });

    it('should support hasAnyPermission (OR logic)', () => {
      const user = {
        id: '1',
        name: 'Test User',
        permissions: ['sales.pos.view'],
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => usePermissions());

      expect(result.current.hasAnyPermission(['sales.pos.create', 'sales.pos.view'])).toBe(true);
      expect(result.current.hasAnyPermission(['sales.pos.create', 'sales.pos.delete'])).toBe(false);
    });

    it('should support hasAllPermissions (AND logic)', () => {
      const user = {
        id: '1',
        name: 'Test User',
        permissions: ['sales.pos.create', 'sales.pos.view'],
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => usePermissions());

      expect(result.current.hasAllPermissions(['sales.pos.create', 'sales.pos.view'])).toBe(true);
      expect(result.current.hasAllPermissions(['sales.pos.create', 'sales.pos.delete'])).toBe(false);
    });

    it('should return true for hasAnyPermission when no permissions specified', () => {
      const user = {
        id: '1',
        name: 'Test User',
        permissions: ['sales.pos.create'],
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => usePermissions());

      expect(result.current.hasAnyPermission([])).toBe(true);
    });

    it('should support role checking', () => {
      const user = {
        id: '1',
        name: 'Test User',
        roles: ['CR', 'HS'],
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => usePermissions());

      expect(result.current.hasRole('CR')).toBe(true);
      expect(result.current.hasRole('HS')).toBe(true);
      expect(result.current.hasRole('SPV')).toBe(false);
      expect(result.current.hasAnyRole(['CR', 'SPV'])).toBe(true);
      expect(result.current.hasAnyRole(['SPV', 'TC'])).toBe(false);
    });

    it('should support single role format (user.role.code)', () => {
      const user = {
        id: '1',
        name: 'Test User',
        role: { code: 'CR', name: 'Cashier' },
      };
      localStorage.setItem('user', JSON.stringify(user));

      const { result } = renderHook(() => usePermissions());

      expect(result.current.hasRole('CR')).toBe(true);
      expect(result.current.hasRole('HS')).toBe(false);
    });

    it('should return empty arrays when user is not logged in', () => {
      const { result } = renderHook(() => usePermissions());

      expect(result.current.userPermissions).toEqual([]);
      expect(result.current.userRoles).toEqual([]);
      expect(result.current.user).toBeNull();
    });
  });
});

